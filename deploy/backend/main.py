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
READ_CACHE_TTL_SECONDS = 15
STATS_CACHE_TTL_SECONDS = 8
CLASSES_CACHE_TTL_SECONDS = 300
_cache: dict[str, tuple[float, Any]] = {}
_count_executor = ThreadPoolExecutor(max_workers=2)


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
url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
service_key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not url or not key:
    raise RuntimeError("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set")

try:
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

        def count_students(filters: dict[str, str] | None = None) -> int:
            query = supabase.table("students").select("id", count="exact", head=True).eq("is_active", True)
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            response = query.execute()
            return int(response.count or 0)

        total_future = _count_executor.submit(count_students)
        new_future = _count_executor.submit(count_students, {"student_type": "new"})
        total_count = total_future.result()
        new_count = new_future.result()

        result = {
            "totalStudents": total_count,
            "newStudents": new_count,
            "oldStudents": max(total_count - new_count, 0),
            "lastUpdated": datetime.now().isoformat()
        }
        return cache_set("dashboard:stats", result, STATS_CACHE_TTL_SECONDS)
    except HTTPException:
        raise
    except Exception as e:
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
    role: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str
    role: Optional[str] = None

@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        admin_client = get_admin_client()
        normalized_email = normalize_email(request.email)

        # Enforce that admin recovery is locked to the specific email
        if request.role == "admin" and not normalized_email.startswith("sandeep.yalla506@gmail"):
            raise HTTPException(status_code=403, detail="Password recovery is only allowed for the authorized admin email.")

        # Enforce that feeInCharge recovery is locked to the specific two emails
        if request.role == "feeInCharge":
            is_sandeep = normalized_email.startswith("sandeep.yalla506@gmail")
            is_schooloxford = normalized_email.startswith("schooloxford2005@gmail")
            if not (is_sandeep or is_schooloxford):
                raise HTTPException(status_code=403, detail="Password recovery is only allowed for authorized fee in-charge emails.")

        user_res = admin_client.table("profiles").select("user_id, email").ilike("email", normalized_email).limit(1).execute()
        if not user_res.data:
            raise HTTPException(status_code=404, detail="User with this email not found")

        logger.info(f"Password reset requested for {normalized_email}")
        user_row = user_res.data[0]
        otp = f"{secrets.randbelow(900000) + 100000}"
        salt = secrets.token_hex(16)
        expires_at = datetime.now() + timedelta(minutes=10)

        admin_client.table("wipe_requests").delete().eq("user_id", user_row["user_id"]).eq("operation_type", "password_reset").execute()
        insert_res = admin_client.table("wipe_requests").insert({
            "user_id": user_row["user_id"],
            "operation_type": "password_reset",
            "otp_hash": hash_otp(otp, salt),
            "otp_salt": salt,
            "expires_at": expires_at.isoformat(),
            "plain_otp": otp,
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

        # Enforce that admin password reset is locked to the specific email
        if request.role == "admin" and not normalized_email.startswith("sandeep.yalla506@gmail"):
            raise HTTPException(status_code=403, detail="Password reset is only allowed for the authorized admin email.")

        # Enforce that feeInCharge password reset is locked to the specific two emails
        if request.role == "feeInCharge":
            is_sandeep = normalized_email.startswith("sandeep.yalla506@gmail")
            is_schooloxford = normalized_email.startswith("schooloxford2005@gmail")
            if not (is_sandeep or is_schooloxford):
                raise HTTPException(status_code=403, detail="Password reset is only allowed for authorized fee in-charge emails.")

        user_res = admin_client.table("profiles").select("user_id").ilike("email", normalized_email).limit(1).execute()
        if not user_res.data:
            raise HTTPException(status_code=404, detail="User with this email not found")
        user_id = user_res.data[0]["user_id"]

        stored = admin_client.table("wipe_requests").select("*").eq("user_id", user_id).eq("operation_type", "password_reset").order("created_at", desc=True).limit(5).execute()
        stored_records = [row for row in (stored.data or []) if not row.get("consumed_at")]
        if not stored_records:
            raise HTTPException(status_code=400, detail="Invalid OTP")

        record = stored_records[0]
        if datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00")) < datetime.now().astimezone():
            raise HTTPException(status_code=400, detail="OTP expired")

        expected_hash = hash_otp(request.otp, record["otp_salt"])
        if not hmac.compare_digest(expected_hash, record["otp_hash"]):
            admin_client.table("wipe_requests").update({
                "updated_at": datetime.now().isoformat(),
            }).eq("id", record["id"]).execute()
            raise HTTPException(status_code=400, detail="Invalid OTP")

        admin_client.auth.admin.update_user_by_id(record["user_id"], {"password": request.new_password})
        admin_client.table("wipe_requests").update({
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
