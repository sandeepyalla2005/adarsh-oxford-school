from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import hashlib
import hmac
import os
import secrets
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
STATS_CACHE_TTL_SECONDS = 60 # 1 minute
CLASSES_CACHE_TTL_SECONDS = 3600 # 1 hour
_cache: dict[str, tuple[float, Any]] = {}

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
        # Verify the token with Supabase
        res = supabase.auth.get_user(token.credentials)
        if not res.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return res.user
    except Exception as e:
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


def send_reset_otp(email: str, otp: str) -> None:
    smtp_host = os.environ.get("SMTP_HOST", "").strip()
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_username = os.environ.get("SMTP_USERNAME", "").strip()
    smtp_password = os.environ.get("SMTP_PASSWORD", "").strip()
    smtp_from = os.environ.get("SMTP_FROM_EMAIL", smtp_username).strip()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() != "false"

    if not smtp_host or not smtp_username or not smtp_password or not smtp_from:
        raise RuntimeError(
            "SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL must be configured to send reset OTPs."
        )

    message = EmailMessage()
    message["Subject"] = "Password Reset OTP"
    message["From"] = smtp_from
    message["To"] = email
    message.set_content(
        "Your password reset OTP is: "
        f"{otp}\n\nThis code expires in 10 minutes."
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)


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

@app.get("/api/students/counts")
def get_student_counts():
    try:
        cached = cache_get("students:counts", READ_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        # 1. Get total count immediately (Fast)
        total_res = supabase.table("students").select("id", count="exact", head=True).eq("is_active", True).execute()
        total_active = int(total_res.count or 0)
        
        counts: dict[str, int] = {"all": total_active}

        # 2. Get class-specific counts
        classes_res = supabase.table("classes").select("id, name").order("sort_order").execute()
        class_list = classes_res.data or []
        
        if class_list:
            def fetch_class_count(cls):
                try:
                    # Ensure ID is a string for the query
                    cid = str(cls["id"])
                    res = supabase.table("students").select("id", count="exact", head=True).eq("class_id", cid).eq("is_active", True).execute()
                    return cls["name"], int(res.count or 0)
                except Exception as e:
                    logger.error(f"Error counting for class {cls.get('name')}: {e}")
                    return cls["name"], 0

            with ThreadPoolExecutor(max_workers=min(len(class_list), 10) or 1) as executor:
                results = list(executor.map(fetch_class_count, class_list))
                
            for cls_name, count in results:
                counts[cls_name] = count
        
        return cache_set("students:counts", counts, READ_CACHE_TTL_SECONDS)
    except Exception as e:
        logger.error(f"Critical error in get_student_counts: {e}")
        # Final fallback: return at least a 0 structure
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

@app.get("/api/dashboard/stats")
def get_dashboard_stats(user=Depends(get_current_user)):
    try:
        cached = cache_get("dashboard:stats", STATS_CACHE_TTL_SECONDS)
        if cached is not None:
            return cached

        logger.info("Fetching fresh dashboard stats...")
        
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
            total = 0.0
            since_date = None
            if days is not None:
                since_date = (datetime.now() - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
            
            for table in tables:
                try:
                    amount_col = "amount_paid"
                    if table == "accessory_sales": amount_col = "total_amount"
                    
                    query = supabase.table(table).select(amount_col)
                    if since_date:
                        query = query.gte("created_at", since_date.isoformat())
                    
                    res = query.execute()
                    if res.data:
                        total += sum(float(row.get(amount_col) or 0) for row in res.data)
                except Exception as e:
                    logger.debug(f"Note: Table {table} not found or inaccessible: {e}")
            return total

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
            for i in range(5, -1, -1):
                start_of_month = (now - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
                
                income = get_income_stats_for_range(start_of_month, end_of_month)
                month_name = start_of_month.strftime("%b")
                
                months.append({
                    "name": month_name,
                    "amount": income,
                    "displayLabel": f"₹{int(income/1000)}k" if income >= 1000 else f"₹{int(income)}",
                    "amountFormatted": f"₹{income:,.0f}"
                })
            return months

        def get_income_stats_for_range(start: datetime, end: datetime) -> float:
            tables = ["course_payments", "books_payments", "transport_payments", "accessory_sales", "student_accessory_payments", "accessory_transactions"]
            total = 0.0
            for table in tables:
                try:
                    amount_col = "amount_paid"
                    if table == "accessory_sales": amount_col = "total_amount"
                    query = supabase.table(table).select(amount_col).gte("created_at", start.isoformat()).lte("created_at", end.isoformat())
                    res = query.execute()
                    if res.data:
                        total += sum(float(row.get(amount_col) or 0) for row in res.data)
                except:
                    pass
            return total

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
        return cache_set("dashboard:stats", result, STATS_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
