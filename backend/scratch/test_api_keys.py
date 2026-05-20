import os
import sys

# Add backend to python path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing environment variables.")
    exit(1)

admin_client = create_client(url, key)

query = admin_client.table("students").select(
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

response = query.execute()
print("Number of students fetched:", len(response.data))
if response.data:
    first_student = response.data[0]
    print("Keys in student dict:", list(first_student.keys()))
    print("First student classes data:", first_student.get("classes"))
