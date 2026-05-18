from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import os
import secrets
import json
import smtplib
from email.message import EmailMessage
from supabase import create_client, Client
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("adarsh-oxford-api")

# Load environment variables
load_dotenv()

app = FastAPI(title="Adarsh Oxford School Management API")
READ_CACHE_TTL_SECONDS = 300 # 5 minutes
STATS_CACHE_TTL_SECONDS = 300 # 5 minutes
CLASSES_CACHE_TTL_SECONDS = 3600 # 1 hour
AUTH_CACHE_TTL = 600 # 10 minutes
_cache: dict[str, tuple[float, Any]] = {}
# WIPE_OTPS: dict[str, str] = {} # Removed in favor of database-backed wipe_requests table

def clear_all_caches():
    global _cache
    _cache = {}
    logger.info("All server-side caches cleared.")


def cache_get(key: str, ttl_seconds: int) -> Any | None:
    entry = _cache.get(key)
    if not entry:
        return None

    expires_at, value = entry
    if expires_at < datetime.now().timestamp():
        _cache.pop(key, None)
        return None

    return value


def cache_set(key: str, value: Any, ttl_seconds: int) -> Any:
    _cache[key] = (datetime.now().timestamp() + ttl_seconds, value)
    return value

def get_cors_origins() -> list[str]:
    configured = os.environ.get("BACKEND_CORS_ORIGINS", "")
    if configured.strip():
        origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
        if origins:
            return origins

    return [
        "http://localhost:4173",
        "http://localhost:4174",
        "http://localhost:4175",
        "http://localhost:4176",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:4174",
        "http://127.0.0.1:4175",
        "http://127.0.0.1:4176",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:8082",
        "http://127.0.0.1:8082",
    ]


# Update CORS to allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase configuration
url: str = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_KEY")
service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SERVICE_ROLE_KEY", "")

if not url or not key:
    logger.error(f"Missing Supabase config! URL: {'set' if url else 'MISSING'}, KEY: {'set' if key else 'MISSING'}")
    raise RuntimeError("Supabase credentials must be set in environment variables.")

try:
    logger.info(f"Initializing Supabase client for: {url}")
    supabase: Client = create_client(url, key)
    admin_supabase: Client | None = create_client(url, service_key) if service_key else None
except Exception as e:
    raise RuntimeError(f"ERROR creating supabase client: {e}") from e


def get_admin_client() -> Client:
    if admin_supabase is None:
        raise HTTPException(
            status_code=503,
            detail="Password reset is unavailable until SUPABASE_SERVICE_ROLE_KEY is configured.",
        )
    return admin_supabase
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

auth_scheme = HTTPBearer()

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(auth_scheme)):
    try:
        # Check cache first
        token_str = token.credentials
        cached = cache_get(f"auth:user:{token_str}", AUTH_CACHE_TTL)
        if cached:
            return cached

        # Verify the token with Supabase
        res = supabase.auth.get_user(token_str)
        if not res.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Fetch role from user_roles table
        user = res.user
        role_res = supabase.table("user_roles").select("role").eq("user_id", user.id).execute()
        
        # Attach role to user object (monkey-patching for convenience in this FastAPI setup)
        user_role = "staff" # Default
        if role_res.data:
            roles = [r["role"] for r in role_res.data]
            if "admin" in roles:
                user_role = "admin"
            elif "feeInCharge" in roles:
                user_role = "feeInCharge"
            elif "staff" in roles:
                user_role = "staff"
        
        setattr(user, "role", user_role)

        # Cache the user
        cache_set(f"auth:user:{token_str}", user, AUTH_CACHE_TTL)
        return user
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def get_current_academic_year(reference_date: Optional[datetime] = None) -> str:
    current = reference_date or datetime.now()
    start_year = current.year if current.month >= 4 else current.year - 1
    end_year_suffix = str((start_year + 1) % 100).zfill(2)
    return f"{start_year}-{end_year_suffix}"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_otp(otp: str, salt: str) -> str:
    payload = f"{salt}:{otp}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def send_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> None:
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_username = os.environ.get("SMTP_USERNAME", "").strip()
    smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", smtp_username).strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

    if not smtp_host or not smtp_username or not smtp_password:
        logger.warning("SMTP not fully configured. Email skipped.")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_from
    message["To"] = to_email
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            if use_tls:
                server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(message)
        logger.info(f"Email sent to {to_email}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")


def _number_to_words(num: int) -> str:
    """Convert a number to Indian English words (matches frontend Receipt.tsx)."""
    a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
         'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
         'Seventeen', 'Eighteen', 'Nineteen']
    b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    if num == 0:
        return 'Zero'
    def convert(n: int) -> str:
        if n < 20:
            return a[n]
        if n < 100:
            return b[n // 10] + (' ' + a[n % 10] if n % 10 else '')
        if n < 1000:
            return a[n // 100] + ' Hundred' + (' and ' + convert(n % 100) if n % 100 else '')
        if n < 100000:
            return convert(n // 1000) + ' Thousand' + (' ' + convert(n % 1000) if n % 1000 else '')
        if n < 10000000:
            return convert(n // 100000) + ' Lakh' + (' ' + convert(n % 100000) if n % 100000 else '')
        return str(n)
    return convert(num).strip()


def build_receipt_html(
    receipt_no: str,
    date_str: str,
    student_name: str,
    admission_no: str,
    class_name: str,
    academic_year: str,
    particulars: list[dict],  # [{name, amount}]
    total_amount: float,
    payment_method: str,
    narration: str,
) -> str:
    """Generate a professional HTML receipt matching the frontend Receipt.tsx design."""
    rows_html = ""
    for idx, item in enumerate(particulars, 1):
        rows_html += f"""
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px 8px;font-weight:500;">{idx}</td>
            <td style="padding:10px 8px;font-weight:700;text-transform:uppercase;">{item['name']}</td>
            <td style="padding:10px 8px;text-align:right;font-weight:700;">₹{item['amount']:,.2f}</td>
        </tr>"""

    amount_words = _number_to_words(int(total_amount))

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#002147;color:#fff;padding:24px 32px;text-align:center;">
        <h1 style="margin:0;font-size:28px;font-weight:900;letter-spacing:1px;">ADARSH OXFORD</h1>
        <p style="margin:4px 0 0;font-size:13px;letter-spacing:3px;opacity:0.8;">ENGLISH MEDIUM SCHOOL</p>
    </div>

    <!-- Receipt Badge -->
    <div style="text-align:center;padding:16px 0 8px;">
        <span style="display:inline-block;background:#002147;color:#fff;padding:6px 28px;border-radius:20px;font-size:14px;font-weight:700;letter-spacing:4px;">RECEIPT</span>
    </div>

    <!-- Student Info -->
    <div style="padding:16px 32px;border-bottom:2px dashed #cbd5e1;">
        <table style="width:100%;font-size:14px;color:#334155;">
            <tr>
                <td style="padding:4px 0;"><strong>Receipt No</strong></td>
                <td style="padding:4px 0;">: {receipt_no}</td>
                <td style="padding:4px 0;"><strong>Date</strong></td>
                <td style="padding:4px 0;">: {date_str}</td>
            </tr>
            <tr>
                <td style="padding:4px 0;"><strong>Name</strong></td>
                <td style="padding:4px 0;">: {student_name}</td>
                <td style="padding:4px 0;"><strong>Acd Year</strong></td>
                <td style="padding:4px 0;">: {academic_year}</td>
            </tr>
            <tr>
                <td style="padding:4px 0;"><strong>Class</strong></td>
                <td style="padding:4px 0;">: {class_name}</td>
                <td style="padding:4px 0;"><strong>Adm No</strong></td>
                <td style="padding:4px 0;">: {admission_no}</td>
            </tr>
        </table>
    </div>

    <!-- Particulars Table -->
    <div style="padding:16px 32px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1e293b;">
            <thead>
                <tr style="border-bottom:2px solid #334155;">
                    <th style="text-align:left;padding:8px;width:50px;">SL</th>
                    <th style="text-align:left;padding:8px;">Particulars</th>
                    <th style="text-align:right;padding:8px;width:120px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
    </div>

    <!-- Totals -->
    <div style="padding:16px 32px;border-top:2px solid #002147;">
        <table style="width:100%;font-size:14px;color:#1e293b;">
            <tr>
                <td style="padding:6px 0;"><strong>Mode Of Payment :</strong> {payment_method.upper()}</td>
                <td style="padding:6px 0;text-align:right;font-size:18px;"><strong>Grand Total : ₹{total_amount:,.2f}</strong></td>
            </tr>
        </table>
        <div style="border-top:1px dashed #94a3b8;margin-top:8px;padding-top:8px;font-size:13px;">
            <strong>Amount In Words :</strong> <em>{amount_words} Rupees Only</em>
        </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px 24px;border-top:1px dashed #002147;font-size:12px;color:#64748b;">
        <p style="margin:4px 0;"><strong>Narration :</strong> {narration}</p>
        <p style="margin:8px 0 0;font-size:11px;">NB:- This is a computer generated receipt and does not require physical signature.</p>
        <div style="display:flex;justify-content:space-between;margin-top:16px;">
            <span>{date_str}</span>
            <span style="color:#002147;font-weight:700;">Created By: Adarsh Oxford</span>
        </div>
    </div>

</div>
</body>
</html>
"""

def send_reset_otp(email: str, otp: str) -> None:
    send_email(
        email, 
        "Password Reset OTP", 
        f"Your password reset OTP is: {otp}\n\nThis code expires in 10 minutes."
    )

def send_sms(phone: str, message: str) -> None:
    auth_key = os.environ.get("VITE_MSG91_AUTH_KEY")
    if not auth_key or not phone:
        logger.warning(f"SMS skipped (missing key or phone). Phone: {phone}")
        return
    
    # Basic log for now as flow/template ID is needed for MSG91 v5
    # But we can try to use the transactional API if configured
    logger.info(f"SMS NOTIFICATION to {phone}: {message}")
    # In a real scenario, we'd use requests.post(...) here


def get_receipt_table_candidates(receipt_type: Optional[str] = None):
    table_map = {
        "course": ("course_payments", "*, students(full_name, admission_number, classes(name))"),
        "books": ("books_payments", "*, students(full_name, admission_number, classes(name))"),
        "transport": ("transport_payments", "*, students(full_name, admission_number, classes(name))"),
        "accessories": ("student_accessory_payments", "*, students(full_name, admission_number, classes(name)), accessory_categories(name)"),
        "accessory": ("accessory_sales", "*, students(full_name, admission_number, classes(name)), accessories(item_name)"),
    }

    if receipt_type:
        if receipt_type not in table_map:
            raise HTTPException(status_code=400, detail="Invalid receipt type")
        return [(receipt_type, *table_map[receipt_type])]

    return [(name, *value) for name, value in table_map.items()]

@app.get("/")
def read_root():
    return {"message": "Adarsh Oxford Management API is running"}

# --- DATA MODELS ---

class AccessoryPayment(BaseModel):
    student_id: str
    category_id: str
    amount_paid: float
    payment_method: str
    remarks: Optional[str] = None
    receipt_number: Optional[str] = None

class StudentActionLog(BaseModel):
    student_id: Optional[str] = None
    student_name: str
    action_type: str
    module_name: str
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    performed_by: str
    performed_by_name: str
    role: str

# --- CORE ENDPOINTS ---

@app.get("/api/classes")
def get_classes():
    try:
        cached = cache_get("classes:all", CLASSES_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        response = supabase.table("classes").select("*").order("sort_order").execute()
        return cache_set("classes:all", response.data, CLASSES_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def purge_deleted_students():
    """Permanently deletes students marked for deletion older than 15 days."""
    try:
        from datetime import datetime, timedelta, timezone
        fifteen_days_ago = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        
        # Purge records marked with DELETED_PENDING_PURGE and older than 15 days
        res = supabase.table("students") \
            .delete() \
            .eq("dropout_reason", "DELETED_PENDING_PURGE") \
            .lt("updated_at", fifteen_days_ago) \
            .execute()
            
        if res.data:
            logger.info(f"Purged {len(res.data)} students from retention queue.")
    except Exception as e:
        logger.error(f"Error purging deleted students: {e}")

@app.get("/api/students/counts")
def get_student_counts():
    try:
        # Trigger purge routine
        purge_deleted_students()

        cached = cache_get("students:counts", READ_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        # 1. Fetch all classes
        classes_res = supabase.table("classes").select("id, name").order("sort_order").execute()
        class_list = classes_res.data or []
        
        # Create map of class_id to name
        class_id_to_name = {c["id"]: c["name"] for c in class_list}
        
        # Initialize counts
        counts: dict[str, int] = {"all": 0}
        for c in class_list:
            counts[c["name"]] = 0
            
        # 2. Fetch all active student class_ids in ONE single query
        students_res = supabase.table("students").select("class_id").eq("is_active", True).execute()
        students_data = students_res.data or []
        
        # 3. Aggregate counts in Python
        for student in students_data:
            counts["all"] += 1
            cid = student.get("class_id")
            if cid in class_id_to_name:
                class_name = class_id_to_name[cid]
                counts[class_name] += 1
        
        return cache_set("students:counts", counts, READ_CACHE_TTL_SECONDS)
    except Exception as e:
        logger.error(f"Critical error in get_student_counts: {e}", exc_info=True)
        return {"all": 0}

@app.post("/api/students/clear-cache")
def clear_student_cache():
    try:
        global _cache
        # Clear all student and dashboard related keys
        keys_to_clear = [k for k in _cache.keys() if k.startswith("students:") or k.startswith("dashboard:") or k.startswith("class-students:")]
        for k in keys_to_clear:
            _cache.pop(k, None)
        logger.info(f"Cleared {len(keys_to_clear)} student-related cache keys.")
        return {"status": "success", "cleared_count": len(keys_to_clear)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/students")
def get_students(class_name: Optional[str] = None):
    try:
        cache_key = f"students:{class_name or 'all'}"
        cached = cache_get(cache_key, READ_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        query = supabase.table("students").select(
            """
            id, admission_number, full_name, class_id, roll_number, gender,
            father_name, father_phone, mother_name, mother_phone,
            dob, aadhaar, address,
            term1_fee, term2_fee, term3_fee,
            has_books, books_fee, has_transport, transport_fee, old_dues,
            parent_email, student_type, joining_date, profile_photo,
            is_active, status, dropout_reason, dropout_date, created_at,
            classes(name)
            """
        ).eq("is_active", True)
        if class_name and class_name != "all":
            # First find class_id
            class_cache_key = f"class-id:{class_name}"
            class_id = cache_get(class_cache_key, CLASSES_CACHE_TTL_SECONDS)
            if class_id is None:
                class_res = supabase.table("classes").select("id").eq("name", class_name).limit(1).execute()
                class_id = class_res.data[0]["id"] if class_res.data else None
                if class_id:
                    cache_set(class_cache_key, class_id, CLASSES_CACHE_TTL_SECONDS)

            if class_id:
                query = query.eq("class_id", class_id)

        response = query.execute()
        return cache_set(cache_key, response.data, READ_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/class-students")
def get_class_students(class_name: str, user=Depends(get_current_user)):
    try:
        normalized_class_name = class_name.strip()
        if not normalized_class_name:
            raise HTTPException(status_code=400, detail="class_name is required")

        cache_key = f"class-students:{normalized_class_name.lower()}"
        cached = cache_get(cache_key, READ_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        class_cache_key = f"class-id:{normalized_class_name.lower()}"
        class_id = cache_get(class_cache_key, CLASSES_CACHE_TTL_SECONDS)
        if class_id is None:
            class_res = supabase.table("classes").select("id").ilike("name", normalized_class_name).limit(1).execute()
            class_id = class_res.data[0]["id"] if class_res.data else None
            if class_id:
                cache_set(class_cache_key, class_id, CLASSES_CACHE_TTL_SECONDS)

        query = supabase.table("students").select(
            """
            id, admission_number, full_name, class_id, roll_number, gender,
            father_name, father_phone, mother_name, mother_phone,
            dob, aadhaar, address,
            term1_fee, term2_fee, term3_fee,
            has_books, books_fee, has_transport, transport_fee, old_dues,
            parent_email, student_type, joining_date, profile_photo,
            is_active, status, dropout_reason, dropout_date, created_at,
            classes(name)
            """
        ).order("full_name")

        if class_id:
            query = query.eq("class_id", class_id)
        elif normalized_class_name.lower() != "all":
            return []

        response = query.execute()
        return cache_set(cache_key, response.data, READ_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/receipts/{receipt_no}")
def get_receipt(receipt_no: str, type: Optional[str] = None, user=Depends(get_current_user)):
    try:
        for receipt_kind, table_name, select_clause in get_receipt_table_candidates(type):
            query = supabase.table(table_name).select(select_clause).eq("receipt_number", receipt_no)
            response = query.execute()
            if response.data:
                return response.data

        raise HTTPException(status_code=404, detail="Receipt not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DASHBOARD & ANALYTICS ---

# Helper: local cache file path
STATS_FILE = os.path.join(os.path.dirname(__file__), "stats.json")

def load_stats_from_disk() -> dict:
    try:
        if os.path.exists(STATS_FILE):
            with open(STATS_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading stats from disk: {e}")
    return {}

def save_stats_to_disk(data: dict):
    try:
        with open(STATS_FILE, "w") as f:
            json.dump(data, f)
    except Exception as e:
        logger.error(f"Error saving stats to disk: {e}")

_refreshing_stats = False

def refresh_dashboard_stats_task():
    global _refreshing_stats
    if _refreshing_stats:
        logger.info("Stats refresh is already in progress, skipping background trigger.")
        return
    
    _refreshing_stats = True
    try:
        logger.info("Background thread: Fetching fresh dashboard stats...")
        
        def count_students(filters: dict[str, str] | None = None) -> int:
            try:
                query = supabase.table("students").select("id", count="exact", head=True).eq("is_active", True)
                if filters:
                    for key, value in filters.items():
                        query = query.eq(key, value)
                response = query.execute()
                return int(response.count or 0)
            except Exception as e:
                logger.error(f"Error in count_students: {e}")
                return 0

        def get_income_stats(days: int | None = None) -> float:
            tables = ["course_payments", "books_payments", "transport_payments", "accessory_sales", "student_accessory_payments", "accessory_transactions"]
            since_date = None
            if days is not None:
                since_date = (datetime.now() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
            
            def fetch_table_total(table):
                try:
                    amount_col = "amount_paid"
                    if table == "accessory_sales": amount_col = "total_amount"
                    
                    query = supabase.table(table).select(amount_col)
                    if since_date:
                        query = query.gte("created_at", since_date.isoformat())
                    
                    res = query.execute()
                    if res.data:
                        return sum(float(row.get(amount_col, 0)) for row in res.data)
                    return 0.0
                except Exception as e:
                    logger.error(f"Error fetching {table}: {e}")
                    return 0.0

            with ThreadPoolExecutor(max_workers=6) as exec:
                results = list(exec.map(fetch_table_total, tables))
            
            return sum(results)

        def get_expected_fees() -> float:
            try:
                res = supabase.table("students").select("term1_fee, term2_fee, term3_fee, old_dues, books_fee, transport_fee").eq("is_active", True).execute()
                total = 0.0
                for s in res.data:
                    total += float(s.get("term1_fee") or 0)
                    total += float(s.get("term2_fee") or 0)
                    total += float(s.get("term3_fee") or 0)
                    total += float(s.get("old_dues") or 0)
                    total += float(s.get("books_fee") or 0)
                    total += float(s.get("transport_fee") or 0)
                return total
            except Exception as e:
                logger.error(f"Error in get_expected_fees: {e}")
                return 0.0

        def get_monthly_income_data() -> list[dict[str, Any]]:
            months = []
            now = datetime.now()
            start_date = (now - timedelta(days=5*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            tables = ["course_payments", "books_payments", "transport_payments", "accessory_sales", "student_accessory_payments", "accessory_transactions"]
            
            # Fetch all data once per table for the 6 month window
            all_data = []
            for table in tables:
                try:
                    amount_col = "amount_paid"
                    if table == "accessory_sales": amount_col = "total_amount"
                    
                    query = supabase.table(table).select(f"created_at, {amount_col}").gte("created_at", start_date.isoformat())
                    res = query.execute()
                    if res.data:
                        for row in res.data:
                            try:
                                dt = datetime.fromisoformat(row["created_at"].replace('Z', '+00:00'))
                                all_data.append({
                                    "date": dt,
                                    "amount": float(row.get(amount_col) or 0)
                                })
                            except (ValueError, TypeError):
                                pass
                except Exception as e:
                    logger.error(f"Error fetching {table} for monthly stats: {e}")
                    
            # Bucket in Python
            for i in range(5, -1, -1):
                start_of_month = (now - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
                
                # We need timezone aware comparisons
                start_aware = start_of_month.astimezone() if start_of_month.tzinfo is None else start_of_month
                end_aware = end_of_month.astimezone() if end_of_month.tzinfo is None else end_of_month
                
                income = sum(item["amount"] for item in all_data if start_aware <= item["date"].astimezone() <= end_aware)
                
                month_name = start_of_month.strftime("%b")
                months.append({
                    "name": month_name,
                    "amount": income,
                    "displayLabel": f"₹{int(income/1000)}k" if income >= 1000 else f"₹{int(income)}",
                    "amountFormatted": f"₹{income:,.0f}"
                })
            return months

        with ThreadPoolExecutor(max_workers=6) as executor:
            total_future = executor.submit(count_students)
            new_future = executor.submit(count_students, {"student_type": "new"})
            today_income_future = executor.submit(get_income_stats, 0)
            weekly_income_future = executor.submit(get_income_stats, 7)
            monthly_income_future = executor.submit(get_income_stats, 30)
            total_income_future = executor.submit(get_income_stats)
            expected_fees_future = executor.submit(get_expected_fees)
            monthly_data_future = executor.submit(get_monthly_income_data)
            
            total_count = total_future.result()
            new_count = new_future.result()
            today_income = today_income_future.result()
            weekly_income = weekly_income_future.result()
            monthly_income = monthly_income_future.result()
            total_collected = total_income_future.result()
            expected_total = expected_fees_future.result()
            monthly_chart_data = monthly_data_future.result()

        result = {
            "totalStudents": total_count,
            "newStudents": new_count,
            "oldStudents": max(total_count - new_count, 0),
            "todayIncome": today_income,
            "weeklyIncome": weekly_income,
            "monthlyIncome": monthly_income,
            "pendingFees": max(expected_total - total_collected, 0),
            "monthlyChartData": monthly_chart_data,
            "lastUpdated": datetime.now().isoformat()
        }
        cache_set("dashboard:stats", result, STATS_CACHE_TTL_SECONDS)
        save_stats_to_disk(result)
        logger.info("Background thread: Successfully refreshed dashboard stats.")
    except Exception as e:
        logger.error(f"Error in background stats refresh: {e}", exc_info=True)
    finally:
        _refreshing_stats = False

@app.get("/api/dashboard/stats")
def get_dashboard_stats(background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    try:
        # 1. Try to read from memory cache
        cached = cache_get("dashboard:stats", STATS_CACHE_TTL_SECONDS)
        
        # 2. If memory cache missed, try reading from disk cache
        if cached is None:
            disk_data = load_stats_from_disk()
            if disk_data:
                logger.info("Memory cache miss. Loaded stats from disk cache.")
                cached = disk_data
                # Put it in memory cache so we don't hit disk on subsequent hits
                cache_set("dashboard:stats", disk_data, STATS_CACHE_TTL_SECONDS)

        # 3. If we have a cached result (from memory or disk):
        if cached is not None:
            # Check if the data is stale (e.g. older than 5 minutes)
            try:
                last_updated_str = cached.get("lastUpdated")
                if last_updated_str:
                    last_updated = datetime.fromisoformat(last_updated_str)
                    is_stale = (datetime.now() - last_updated).total_seconds() > STATS_CACHE_TTL_SECONDS
                else:
                    is_stale = True
            except Exception:
                is_stale = True

            if is_stale:
                logger.info("Stats cache is stale. Triggering background refresh...")
                background_tasks.add_task(refresh_dashboard_stats_task)
            
            return cached

        # 4. Fallback if absolutely no cache exists (e.g., first run ever)
        default_stats = {
            "totalStudents": 0,
            "newStudents": 0,
            "oldStudents": 0,
            "todayIncome": 0.0,
            "weeklyIncome": 0.0,
            "monthlyIncome": 0.0,
            "pendingFees": 0.0,
            "monthlyChartData": [],
            "lastUpdated": datetime.now().isoformat()
        }
        logger.info("No stats cache found. Triggering background refresh and returning default stats.")
        background_tasks.add_task(refresh_dashboard_stats_task)
        return default_stats
    except Exception as e:
        logger.error(f"Dashboard stats error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/notices")
def get_notices():
    try:
        cached = cache_get("notices:top5", READ_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        response = supabase.table("notices").select("*").order("pinned", desc=True).order("created_at", desc=True).limit(5).execute()
        return cache_set("notices:top5", response.data, READ_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/fee-structure/{structure_id}")
async def delete_fee_structure_api(structure_id: str, user=Depends(get_current_user)):
    """Deletes a fee structure using admin privileges to bypass RLS."""
    try:
        if not (user.role == 'admin' or user.role == 'feeInCharge'):
             raise HTTPException(status_code=403, detail="Permission denied. Only admins can delete fee structures.")
        
        admin_client = get_admin_client()
        res = admin_client.table("fee_structure").delete().eq("id", structure_id).execute()
        
        logger.info(f"Fee structure {structure_id} deleted by user {user.id}")
        return {"status": "success", "message": "Fee structure deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete fee structure {structure_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class PaymentCollectionRequest(BaseModel):
    student_id: str
    type: str # 'course', 'books', 'transport'
    academic_year: str
    amount: float
    method: str
    term: Optional[int] = 1
    receipt_number: str

@app.post("/api/payments/collect")
async def collect_payment(request: PaymentCollectionRequest, user=Depends(get_current_user)):
    try:
        admin_client = get_admin_client()
        
        # 1. Map type to table
        table_map = {
            "course": "course_payments",
            "books": "books_payments",
            "transport": "transport_payments"
        }
        table = table_map.get(request.type)
        if not table:
            raise HTTPException(status_code=400, detail="Invalid payment type")
            
        # 2. Prepare data
        payment_data = {
            "student_id": request.student_id,
            "academic_year": request.academic_year,
            "amount_paid": request.amount,
            "payment_method": request.method,
            "receipt_number": request.receipt_number,
            "collected_by": user.id
        }
        if request.type == "course":
            payment_data["term"] = request.term
            
        # 3. Insert record
        res = admin_client.table(table).insert(payment_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to record payment")
            
        # 4. Fetch student & parent info for notifications
        student_res = admin_client.table("students")\
            .select("full_name, admission_number, father_phone, mother_phone, classes(name)")\
            .eq("id", request.student_id)\
            .single()\
            .execute()
            
        student = student_res.data
        if student:
            phone = student.get("father_phone") or student.get("mother_phone")
            student_name = student.get("full_name")
            class_name = student.get("classes", {}).get("name", "N/A")
            admission_no = student.get("admission_number", "N/A")
            
            # 5. Send SMS to Parent
            if phone:
                sms_msg = f"Dear Parent, fee payment of Rs.{request.amount} for {student_name} ({class_name}) has been received. Receipt: {request.receipt_number}. Thank you - Adarsh Oxford School"
                send_sms(phone, sms_msg)
                
            # 6. Build receipt and send HTML receipt email to School
            now = datetime.now()
            date_str = now.strftime("%d %b %Y")

            # Determine particulars label based on payment type
            if request.type == "course":
                particular_name = f"COURSE FEE ({'OLD DUE' if request.term == 0 else f'Term {request.term}'})"
            elif request.type == "books":
                particular_name = "BOOKS & ACCESSORIES"
            elif request.type == "transport":
                particular_name = "TRANSPORT FEE"
            else:
                particular_name = f"{request.type.upper()} FEE"

            particulars = [{"name": particular_name, "amount": request.amount}]
            narration = f"Fees for {particular_name}"

            receipt_html = build_receipt_html(
                receipt_no=request.receipt_number,
                date_str=date_str,
                student_name=student_name,
                admission_no=admission_no,
                class_name=class_name,
                academic_year=request.academic_year,
                particulars=particulars,
                total_amount=request.amount,
                payment_method=request.method,
                narration=narration,
            )

            plain_text = (
                f"Fee Receipt – {student_name}\n\n"
                f"Receipt No: {request.receipt_number}\n"
                f"Date: {date_str}\n"
                f"Student: {student_name} ({admission_no})\n"
                f"Class: {class_name}\n"
                f"Amount: Rs.{request.amount:,.2f}\n"
                f"Type: {particular_name}\n"
                f"Method: {request.method}\n\n"
                f"-- Adarsh Oxford English Medium School"
            )

            school_email = os.environ.get("WIPE_NOTIFICATION_EMAIL", "sandeep.yalla506@gmail.com")
            email_subject = f"Fee Receipt: {student_name} – ₹{request.amount:,.0f} ({request.receipt_number})"
            send_email(school_email, email_subject, plain_text, html_body=receipt_html)
            
        return {"status": "success", "receipt_number": request.receipt_number}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment collection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- STUDENT DROPOUT APPROVAL WORKFLOW ---

class DropoutRequest(BaseModel):
    student_id: str
    reason: str

@app.post("/api/students/request-dropout")
async def request_dropout(request: DropoutRequest, user=Depends(get_current_user)):
    """Allows Fee In Charge to request a student dropout, pending Admin approval."""
    try:
        admin_client = get_admin_client()
        
        # 1. Fetch complete student details including classes
        student_res = admin_client.table("students").select("*, classes(name)").eq("id", request.student_id).single().execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found")
        
        student_data = student_res.data
        if student_data.get("status") == "dropout":
            raise HTTPException(status_code=400, detail="Student is already marked as dropout")

        # 2. Update status to 'dropout_pending'
        res = admin_client.table("students").update({
            "status": "dropout_pending",
            "dropout_reason": f"PENDING APPROVAL: {request.reason}",
            "updated_at": datetime.now().isoformat()
        }).eq("id", request.student_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update student status")
            
        # 3. Calculate Pending Fees
        t1 = float(student_data.get("term1_fee") or 0.0)
        t2 = float(student_data.get("term2_fee") or 0.0)
        t3 = float(student_data.get("term3_fee") or 0.0)
        books = float(student_data.get("books_fee") or 0.0) if student_data.get("has_books") else 0.0
        transport = float(student_data.get("transport_fee") or 0.0) if student_data.get("has_transport") else 0.0
        old_dues = float(student_data.get("old_dues") or 0.0)
        total_pending = t1 + t2 + t3 + books + transport + old_dues

        if total_pending > 0:
            raise HTTPException(status_code=400, detail=f"Cannot dropout student with pending fees (₹{total_pending:,.2f}). Please clear or waive outstanding dues first!")

        # 4. Generate Enriched HTML Email Body
        email_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
                .header {{ background-color: #002147; padding: 24px; text-align: center; color: #ffffff; }}
                .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }}
                .header p {{ margin: 4px 0 0; font-size: 13px; opacity: 0.8; font-weight: 600; letter-spacing: 1px; }}
                .content {{ padding: 32px; }}
                .reason-box {{ background-color: #fef3c7; border-left: 4px solid #d97706; padding: 16px; border-radius: 8px; margin-bottom: 24px; }}
                .reason-title {{ font-size: 11px; text-transform: uppercase; font-weight: 800; color: #b45309; letter-spacing: 1px; margin-bottom: 4px; }}
                .reason-text {{ font-size: 15px; font-weight: 600; color: #78350f; margin: 0; }}
                .section {{ margin-bottom: 24px; }}
                .section-title {{ font-size: 12px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 1.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }}
                .cell {{ background-color: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; }}
                .label {{ font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 2px; }}
                .value {{ font-size: 14px; font-weight: 700; color: #334155; }}
                .fee-row {{ display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px dashed #f1f5f9; font-size: 13px; }}
                .fee-row:last-child {{ border-bottom: none; }}
                .fee-total {{ display: flex; justify-content: space-between; padding: 12px; background-color: #fef2f2; border-radius: 8px; margin-top: 8px; font-weight: 800; color: #b91c1c; font-size: 15px; }}
                .footer {{ background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; font-weight: 600; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>ADARSH OXFORD</h1>
                    <p>STUDENT DROPOUT REQUEST</p>
                </div>
                <div class="content">
                    <div class="reason-box">
                        <div class="reason-title">Reason for Dropout Request</div>
                        <div class="reason-text">"{request.reason}"</div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Student Profile</div>
                        <div class="grid">
                            <div class="cell">
                                <div class="label">Full Name</div>
                                <div class="value">{student_data.get("full_name")}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Class</div>
                                <div class="value">{student_data.get("classes", {}).get("name", "N/A")}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Admission No</div>
                                <div class="value">{student_data.get("admission_number" or "N/A")}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Roll Number</div>
                                <div class="value">{student_data.get("roll_number") or "N/A"}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Gender</div>
                                <div class="value">{student_data.get("gender") or "N/A"}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Date of Birth</div>
                                <div class="value">{student_data.get("dob") or "N/A"}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Parent Contact Information</div>
                        <div class="grid">
                            <div class="cell">
                                <div class="label">Father's Name</div>
                                <div class="value">{student_data.get("father_name") or "N/A"}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Father's Phone</div>
                                <div class="value">{student_data.get("father_phone") or "N/A"}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Mother's Name</div>
                                <div class="value">{student_data.get("mother_name") or "N/A"}</div>
                            </div>
                            <div class="cell">
                                <div class="label">Mother's Phone</div>
                                <div class="value">{student_data.get("mother_phone") or "N/A"}</div>
                            </div>
                        </div>
                        <div class="cell" style="margin-top: 12px;">
                            <div class="label">Address</div>
                            <div class="value" style="font-weight: 500;">{student_data.get("address") or "N/A"}</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">Outstanding Pending Fees</div>
                        <div style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; overflow: hidden; padding: 8px 0;">
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Term 1 Course Fee</span>
                                <span style="font-weight: 700; color: #475569;">₹{t1:,.2f}</span>
                            </div>
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Term 2 Course Fee</span>
                                <span style="font-weight: 700; color: #475569;">₹{t2:,.2f}</span>
                            </div>
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Term 3 Course Fee</span>
                                <span style="font-weight: 700; color: #475569;">₹{t3:,.2f}</span>
                            </div>
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Books Fee</span>
                                <span style="font-weight: 700; color: #475569;">₹{books:,.2f}</span>
                            </div>
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Transport Fee</span>
                                <span style="font-weight: 700; color: #475569;">₹{transport:,.2f}</span>
                            </div>
                            <div class="fee-row">
                                <span style="font-weight: 500; color: #64748b;">Old Outstanding Dues</span>
                                <span style="font-weight: 700; color: #475569;">₹{old_dues:,.2f}</span>
                            </div>
                            <div class="fee-total">
                                <span>TOTAL PENDING BALANCE</span>
                                <span>₹{total_pending:,.2f}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="footer">
                    Requested by User: {user.id} | Action Logged Systematically
                </div>
            </div>
        </body>
        </html>
        """

        # 5. Notify Admin (via email)
        admin_email = os.environ.get("WIPE_NOTIFICATION_EMAIL", "sandeep.yalla506@gmail.com")
        student_name = student_data.get("full_name")
        plain_text = f"Dropout requested for {student_name}.\n\nReason: {request.reason}\n\nPlease review full profile and outstanding fee details in your inbox or Admin Portal."
        
        send_email(
            admin_email,
            f"Dropout Alert: {student_name} ({student_data.get('classes', {}).get('name', 'N/A')})",
            plain_text,
            html_body=email_html
        )
        
        return {"status": "success", "message": "Dropout request submitted to Admin for approval."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dropout request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/students/approve-dropout/{student_id}")
async def approve_dropout(student_id: str, user=Depends(get_current_user)):
    """Allows Admin to finalize a pending dropout request."""
    try:
        if user.role != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can approve dropout requests")
            
        admin_client = get_admin_client()
        
        # 1. Fetch complete details of the student including fees
        student_res = admin_client.table("students").select("*, classes(name)").eq("id", student_id).single().execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found")
            
        student_data = student_res.data
        t1 = float(student_data.get("term1_fee") or 0.0)
        t2 = float(student_data.get("term2_fee") or 0.0)
        t3 = float(student_data.get("term3_fee") or 0.0)
        books = float(student_data.get("books_fee") or 0.0) if student_data.get("has_books") else 0.0
        transport = float(student_data.get("transport_fee") or 0.0) if student_data.get("has_transport") else 0.0
        old_dues = float(student_data.get("old_dues") or 0.0)
        total_pending = t1 + t2 + t3 + books + transport + old_dues

        if total_pending > 0:
            raise HTTPException(status_code=400, detail=f"Cannot approve dropout for student with pending fees (₹{total_pending:,.2f}). Please clear or waive outstanding dues first!")

        full_reason = student_data.get("dropout_reason", "")
        clean_reason = full_reason.replace("PENDING APPROVAL: ", "")
        
        # 2. Finalize status
        res = admin_client.table("students").update({
            "status": "dropout",
            "is_active": False,
            "dropout_reason": clean_reason,
            "dropout_date": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }).eq("id", student_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to finalize dropout")
            
        return {"status": "success", "message": f"Dropout for {student_data.get('full_name')} has been approved."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dropout approval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/students/reject-dropout/{student_id}")
async def reject_dropout(student_id: str, user=Depends(get_current_user)):
    """Allows Admin to reject a pending dropout request."""
    try:
        if user.role != 'admin':
            raise HTTPException(status_code=403, detail="Only admins can reject dropout requests")
            
        admin_client = get_admin_client()
        
        # 1. Reset status to active
        res = admin_client.table("students").update({
            "status": "active",
            "is_active": True,
            "dropout_reason": None,
            "updated_at": datetime.now().isoformat()
        }).eq("id", student_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to reject dropout")
            
        return {"status": "success", "message": "Dropout request rejected. Student remains active."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dropout rejection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def verify_action_otp(user_id: str, op_type: str, otp: str) -> bool:
    try:
        admin_client = get_admin_client()
        now = datetime.now().isoformat()
        res = admin_client.table("wipe_requests")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("operation_type", op_type)\
            .is_("consumed_at", "null")\
            .gt("expires_at", now)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        if not res.data:
            return False
            
        record = res.data[0]
        expected_hash = hash_otp(str(otp), record["otp_salt"])
        if hmac.compare_digest(expected_hash, record["otp_hash"]):
            # Consume it
            admin_client.table("wipe_requests").update({"consumed_at": datetime.now().isoformat()}).eq("id", record["id"]).execute()
            return True
    except Exception as e:
        logger.error(f"OTP validation error: {e}")
    return False


class PromoteStudentsRequest(BaseModel):
    otp: Optional[str] = None

@app.post("/api/students/promote")
async def promote_students(req: PromoteStudentsRequest, user=Depends(get_current_user)):
    try:
        user_role = getattr(user, "role", "staff")
        if user_role not in ["admin", "feeInCharge"]:
            raise HTTPException(status_code=403, detail="Not authorized to promote students")
            
        if user_role == "feeInCharge":
            if not req.otp:
                raise HTTPException(status_code=400, detail="OTP is required for Fee In-Charge users")
            if not verify_action_otp(user.id, "promote", req.otp):
                raise HTTPException(status_code=401, detail="Invalid or expired Admin OTP")
                
        admin_client = get_admin_client()
        # Fetch classes ordered by sort_order
        class_res = admin_client.table("classes").select("id, sort_order, name").order("sort_order").execute()
        if not class_res.data:
            raise HTTPException(status_code=400, detail="No classes found to promote students")
            
        classes = class_res.data
        promoted = 0
        skipped = 0
        
        for i in range(len(classes)):
            current = classes[i]
            if i + 1 >= len(classes):
                # Highest class, count as skipped
                count_res = admin_client.table("students").select("id", count="exact", head=True).eq("class_id", current["id"]).eq("is_active", True).execute()
                skipped += count_res.count or 0
                continue
                
            next_class = classes[i + 1]
            students_res = admin_client.table("students")\
                .select("id, term1_fee, term2_fee, term3_fee, old_dues, books_fee, transport_fee, has_books, has_transport")\
                .eq("class_id", current["id"])\
                .eq("is_active", True)\
                .execute()
                
            if students_res.data:
                for student in students_res.data:
                    # Calculate outstanding balance
                    t1 = float(student.get("term1_fee") or 0.0)
                    t2 = float(student.get("term2_fee") or 0.0)
                    t3 = float(student.get("term3_fee") or 0.0)
                    books = float(student.get("books_fee") or 0.0) if student.get("has_books") else 0.0
                    transport = float(student.get("transport_fee") or 0.0) if student.get("has_transport") else 0.0
                    old_dues_curr = float(student.get("old_dues") or 0.0)
                    new_old_dues = t1 + t2 + t3 + books + transport + old_dues_curr
                    
                    # Update student: class_id, carry forward outstanding fees as old_dues, reset term fees and options
                    admin_client.table("students").update({
                        "class_id": next_class["id"],
                        "old_dues": new_old_dues,
                        "term1_fee": 0.0,
                        "term2_fee": 0.0,
                        "term3_fee": 0.0,
                        "books_fee": 0.0,
                        "has_books": False,
                        "transport_fee": 0.0,
                        "has_transport": False,
                        "updated_at": datetime.now().isoformat()
                    }).eq("id", student["id"]).execute()
                    promoted += 1
            
        clear_all_caches()
        return {
            "status": "success",
            "message": f"Promoted {promoted} students. Skipped {skipped} students in the highest class.",
            "promoted": promoted,
            "skipped": skipped
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DeleteStudentRequest(BaseModel):
    otp: Optional[str] = None

@app.post("/api/students/delete/{student_id}")
async def delete_student(student_id: str, req: DeleteStudentRequest, user=Depends(get_current_user)):
    try:
        user_role = getattr(user, "role", "staff")
        if user_role not in ["admin", "feeInCharge"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete students")
            
        admin_client = get_admin_client()
        
        # 1. Fetch student details to verify pending fees
        student_res = admin_client.table("students").select("full_name, term1_fee, term2_fee, term3_fee, old_dues, books_fee, transport_fee, has_books, has_transport").eq("id", student_id).single().execute()
        if not student_res.data:
            raise HTTPException(status_code=404, detail="Student not found")
            
        student_data = student_res.data
        t1 = float(student_data.get("term1_fee") or 0.0)
        t2 = float(student_data.get("term2_fee") or 0.0)
        t3 = float(student_data.get("term3_fee") or 0.0)
        books = float(student_data.get("books_fee") or 0.0) if student_data.get("has_books") else 0.0
        transport = float(student_data.get("transport_fee") or 0.0) if student_data.get("has_transport") else 0.0
        old_dues = float(student_data.get("old_dues") or 0.0)
        total_pending = t1 + t2 + t3 + books + transport + old_dues

        if total_pending > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete student with pending fees (₹{total_pending:,.2f}). Please clear or waive outstanding dues first!")

        if user_role == "feeInCharge":
            if not req.otp:
                raise HTTPException(status_code=400, detail="OTP is required for Fee In-Charge users")
            if not verify_action_otp(user.id, "delete_student", req.otp):
                raise HTTPException(status_code=401, detail="Invalid or expired Admin OTP")
                
        # Soft delete the student: status = dropout, is_active = false, dropout_reason = DELETED_PENDING_PURGE
        res = admin_client.table("students").update({
            "status": "dropout",
            "is_active": False,
            "dropout_reason": "DELETED_PENDING_PURGE",
            "dropout_date": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }).eq("id", student_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Student not found or deletion failed")
            
        clear_all_caches()
        return {"status": "success", "message": "Student moved to deletion queue (15-day retention)."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Student delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RemoveClassRequest(BaseModel):
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    otp: Optional[str] = None

@app.post("/api/students/remove-class")
async def remove_class_students(req: RemoveClassRequest, user=Depends(get_current_user)):
    try:
        user_role = getattr(user, "role", "staff")
        if user_role not in ["admin", "feeInCharge"]:
            raise HTTPException(status_code=403, detail="Not authorized to remove students")
            
        if user_role == "feeInCharge":
            if not req.otp:
                raise HTTPException(status_code=400, detail="OTP is required for Fee In-Charge users")
            if not verify_action_otp(user.id, "remove_class", req.otp):
                raise HTTPException(status_code=401, detail="Invalid or expired Admin OTP")
                
        admin_client = get_admin_client()
        
        if req.class_name == "all" or not req.class_id:
            # Soft delete all students across all classes
            res = admin_client.table("students").update({
                "status": "dropout",
                "is_active": False,
                "dropout_reason": "DELETED_PENDING_PURGE",
                "dropout_date": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }).neq("id", "00000000-0000-0000-0000-000000000000").execute()
        else:
            # Soft delete students only in this class
            res = admin_client.table("students").update({
                "status": "dropout",
                "is_active": False,
                "dropout_reason": "DELETED_PENDING_PURGE",
                "dropout_date": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }).eq("class_id", req.class_id).execute()
            
        count = len(res.data) if res.data else 0
        clear_all_caches()
        return {"status": "success", "message": f"Successfully removed {count} students class records.", "count": count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Class remove error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- AUTH & SECURITY (FORGOT PASSWORD) ---

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        admin_client = get_admin_client()
        normalized_email = normalize_email(request.email)

        user_res = admin_client.table("profiles").select("user_id, email").ilike("email", normalized_email).limit(1).execute()
        if not user_res.data:
            raise HTTPException(status_code=404, detail="User with this email not found")

        logger.info(f"Password reset requested for {normalized_email}")
        user_row = user_res.data[0]
        otp = f"{secrets.randbelow(900000) + 100000}"
        salt = secrets.token_hex(16)
        expires_at = datetime.now() + timedelta(minutes=10)

        admin_client.table("password_reset_otps").delete().eq("email", normalized_email).execute()
        insert_res = admin_client.table("password_reset_otps").insert({
            "user_id": user_row["user_id"],
            "email": normalized_email,
            "otp_hash": hash_otp(otp, salt),
            "otp_salt": salt,
            "expires_at": expires_at.isoformat(),
        }).execute()

        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to create password reset token")

        send_reset_otp(normalized_email, otp)

        return {"status": "success", "message": "OTP sent to your email"}
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    try:
        admin_client = get_admin_client()
        normalized_email = normalize_email(request.email)

        stored = admin_client.table("password_reset_otps").select("*").eq("email", normalized_email).order("created_at", desc=True).limit(5).execute()
        stored_records = [row for row in (stored.data or []) if not row.get("consumed_at")]
        if not stored_records:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        record = stored_records[0]
        if datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00")) < datetime.now().astimezone():
            raise HTTPException(status_code=400, detail="OTP expired")

        expected_hash = hash_otp(request.otp, record["otp_salt"])
        if not hmac.compare_digest(expected_hash, record["otp_hash"]):
            admin_client.table("password_reset_otps").update({
                "attempts": int(record.get("attempts", 0)) + 1,
                "updated_at": datetime.now().isoformat(),
            }).eq("id", record["id"]).execute()
            raise HTTPException(status_code=400, detail="Invalid OTP")

        admin_client.auth.admin.update_user_by_id(record["user_id"], {"password": request.new_password})
        admin_client.table("password_reset_otps").update({
            "consumed_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }).eq("id", record["id"]).execute()
        
        return {"status": "success", "message": "Password updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ACCESSORIES & PAYMENTS ENDPOINTS ---

@app.get("/api/accessories/categories")
def get_accessory_categories():
    try:
        response = supabase.table("accessory_categories").select("*").eq("is_active", True).order("created_at").execute()
        return response.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/payments/accessories")
async def create_accessory_payment(payment: AccessoryPayment, user=Depends(get_current_user)):
    try:
        logger.info(f"Creating accessory payment for student {payment.student_id} by user {user.id}")
        receipt_number = payment.receipt_number or f"ACC-{os.urandom(4).hex().upper()}"
        
        payment_data = {
            "student_id": payment.student_id,
            "category_id": payment.category_id,
            "academic_year": get_current_academic_year(),
            "amount_paid": payment.amount_paid,
            "payment_method": payment.payment_method,
            "receipt_number": receipt_number,
            "remarks": payment.remarks
        }
        
        response = supabase.table("student_accessory_payments").insert(payment_data).execute()
        return {"status": "success", "receipt_number": receipt_number, "data": response.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health-check")
def health_check():
    return {
        "status": "online",
        "supabase_url_prefix": url[:15] if url else "missing",
        "project_id": os.environ.get("VITE_SUPABASE_PROJECT_ID", "missing")
    }

# --- WIPE ALL CONFIRMATION ---

@app.post("/api/auth/request-wipe")
async def request_wipe(request: Optional[dict] = None, user=Depends(get_current_user)):
    """Initiates a wipe request and generates an OTP stored in the database."""
    try:
        admin_client = get_admin_client()
        op_type = (request or {}).get("operation", "students")
        
        otp = f"{secrets.randbelow(900000) + 100000}"
        salt = secrets.token_hex(16)
        expires_at = datetime.now() + timedelta(minutes=10)
        
        # Store in database
        admin_client.table("wipe_requests").delete().eq("user_id", user.id).eq("operation_type", op_type).is_("consumed_at", "null").execute()
        admin_client.table("wipe_requests").insert({
            "user_id": user.id,
            "operation_type": op_type,
            "otp_hash": hash_otp(otp, salt),
            "otp_salt": salt,
            "plain_otp": None, # Do NOT store cleartext OTP in DB for dashboard security
            "expires_at": expires_at.isoformat(),
        }).execute()
        
        logger.info(f"Wipe OTP generated for user {user.id} ({op_type})")
        
        # Try to send email
        notify_email = os.environ.get("WIPE_NOTIFICATION_EMAIL", "").strip()
        if not notify_email:
            admin_res = admin_client.table("profiles").select("email").eq("designation", "Super Admin").limit(1).execute()
            if admin_res.data:
                notify_email = admin_res.data[0]["email"]
        
        if notify_email:
            send_reset_otp(notify_email, f"Security Alert: A wipe request for '{op_type}' has been initiated.\n\nOTP Code: {otp}\n\nRequested by user: {user.id}\nExpires in 10 minutes.")
            logger.info(f"Wipe OTP email sent to: {notify_email}")
        else:
            logger.warning("No administrator email found for wipe notification. OTP generated but not emailed.")
            
        return {"status": "success", "message": f"Wipe request for '{op_type}' initiated. OTP has been sent to Admin's registered email."}
        
    except Exception as e:
        logger.error(f"Wipe OTP request failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate wipe: {str(e)}")

@app.get("/api/auth/admin/pending-wipes")
async def get_pending_wipes(user=Depends(get_current_user)):
    """Returns pending wipe requests for the Admin Portal without exposing the secure OTP."""
    try:
        if getattr(user, "role", None) != "admin":
            return [] # Non-admins see nothing
        
        # Fetch from database instead of memory
        now = datetime.now().isoformat()
        w_res = admin_client.table("wipe_requests").select("*, profiles(full_name)").is_("consumed_at", "null").gt("expires_at", now).execute()
        
        enriched = []
        for row in (w_res.data or []):
            name = row.get("profiles", {}).get("full_name") if row.get("profiles") else "Unknown User"
            enriched.append({
                "user_id": row["user_id"], 
                "user_name": name, 
                "otp": "******", # Explicitly mask OTP so it is not visible on the Admin screen (Gmail only)
                "operation": row.get("operation_type", "students"),
                "created_at": row["created_at"]
            })
        return enriched
    except Exception as e:
        logger.error(f"Error fetching pending wipes: {e}")
        return []

@app.post("/api/students/wipe-all")
async def wipe_all_students(request: dict, user=Depends(get_current_user)):
    """Verifies OTP and performs the mass deletion of students."""
    return await handle_wipe_operation("students", request, user)

@app.post("/api/staff/wipe-all")
async def wipe_all_staff(request: dict, user=Depends(get_current_user)):
    """Verifies OTP and performs the mass deletion of staff."""
    return await handle_wipe_operation("staff", request, user)

async def handle_wipe_operation(op_type: str, request: dict, user):
    try:
        admin_client = get_admin_client()
        otp = request.get("otp")
        if not otp:
            raise HTTPException(status_code=400, detail="OTP is required")
            
        # Validate OTP from database
        now = datetime.now().isoformat()
        res = admin_client.table("wipe_requests")\
            .select("*")\
            .eq("user_id", user.id)\
            .eq("operation_type", op_type)\
            .is_("consumed_at", "null")\
            .gt("expires_at", now)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        if not res.data:
            raise HTTPException(status_code=401, detail="No active wipe request found or OTP expired")
            
        record = res.data[0]
        expected_hash = hash_otp(str(otp), record["otp_salt"])
        
        if not hmac.compare_digest(expected_hash, record["otp_hash"]):
            raise HTTPException(status_code=401, detail="Invalid OTP code")
            
        # Proceed with wipe
        if op_type == "students":
            # Bulk delete students (except a dummy if needed, but here we delete all)
            # We use admin_client to bypass RLS if necessary, though delete().neq() is standard
            wipe_res = admin_client.table("students").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            count = len(wipe_res.data) if wipe_res.data else 0
        elif op_type == "staff":
            # Call the RPC for staff deletion as it handles auth users too
            wipe_res = admin_client.rpc("delete_all_staff_users").execute()
            count = "All" # RPC might not return count easily
        else:
            raise HTTPException(status_code=400, detail="Invalid operation type")
            
        # Log action
        logger.info(f"USER {user.id} WIPED {op_type.upper()} using validated OTP")
        
        # Mark OTP as consumed
        admin_client.table("wipe_requests").update({"consumed_at": datetime.now().isoformat()}).eq("id", record["id"]).execute()
        
        # Clear all caches
        clear_all_caches()
        
        return {"status": "success", "count": count, "operation": op_type}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in {op_type} wipe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
