import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

tables = [
    "students", "classes", "profiles", "user_roles", "fee_history", 
    "academic_calendar", "wipe_requests", "audit_logs", 
    "left_student_fee_records", "qr_fee_payments", "fine_payments", "misc_payments"
]

print("Checking tables in database:")
for t in tables:
    try:
        supabase.table(t).select("id").limit(1).execute()
        print(f"  [YES] Table '{t}' exists.")
    except Exception as e:
        print(f"  [NO] Table '{t}' query failed: {e}")
