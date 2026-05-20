import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

multi_line_select = """
id, admission_number, full_name, class_id, roll_number, gender,
father_name, father_phone, mother_name, mother_phone,
dob, aadhaar, address,
term1_fee, term2_fee, term3_fee,
has_books, books_fee, has_transport, transport_fee, old_dues,
parent_email, student_type, joining_date, profile_photo,
is_active, status, dropout_reason, dropout_date, created_at,
classes(name)
"""

single_line_select = "id,admission_number,full_name,class_id,roll_number,gender,father_name,father_phone,mother_name,mother_phone,dob,aadhaar,address,term1_fee,term2_fee,term3_fee,has_books,books_fee,has_transport,transport_fee,old_dues,parent_email,student_type,joining_date,profile_photo,is_active,status,dropout_reason,dropout_date,created_at,classes(name)"

print("Testing multi line...")
res_multi = supabase.table("students").select(multi_line_select).limit(1).execute()
print("Multi-line result keys:", list(res_multi.data[0].keys()) if res_multi.data else "No data")
if res_multi.data:
    print("Multi-line classes:", res_multi.data[0].get("classes"))

print("\nTesting single line...")
res_single = supabase.table("students").select(single_line_select).limit(1).execute()
print("Single-line result keys:", list(res_single.data[0].keys()) if res_single.data else "No data")
if res_single.data:
    print("Single-line classes:", res_single.data[0].get("classes"))
