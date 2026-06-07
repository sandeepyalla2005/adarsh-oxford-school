import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

print("Starting DB wipe and setup for academic year 2026-27...")

# 1. Clean up payments and dependent tables
tables_to_wipe = [
    "attendance_records",
    "course_payments",
    "books_payments",
    "transport_payments",
    "student_accessory_payments",
    "fine_payments",
    "misc_payments",
    "left_student_recovery_payments",
    "left_student_fee_records",
    "student_accessory_fees",
    "qr_fee_payments",
    "students"
]

for t in tables_to_wipe:
    try:
        # We delete all records
        res = supabase.table(t).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print(f"  Wiped table '{t}': deleted {len(res.data) if res.data else 0} records.")
    except Exception as e:
        print(f"  Warning/Error wiping table '{t}': {e}")

# 2. Set academic year to 2026-27 in settings
try:
    settings_res = supabase.table("school_settings").select("*").execute()
    if settings_res.data:
        setting_id = settings_res.data[0]["id"]
        up_res = supabase.table("school_settings").update({
            "current_academic_year": "2026-27"
        }).eq("id", setting_id).execute()
        print(f"Updated school settings current_academic_year to '2026-27'.")
    else:
        print("No school settings row found to update!")
except Exception as e:
    print("Failed to update school settings:", e)

# 3. Clone/ensure fee structure for 2026-27 for all classes
try:
    # Fetch existing structures
    existing_fs = supabase.table("fee_structure").select("*").execute()
    # Find ones for 2031-32 or 2031-2032
    fs_to_clone = [r for r in existing_fs.data if r.get("academic_year") in ["2031-32", "2031-2032"]]
    
    # Check what classes already have 2026-27 fee structure
    classes_with_2026 = {r["class_id"] for r in existing_fs.data if r.get("academic_year") in ["2026-27", "2026-2027"]}
    
    cloned_count = 0
    for fs in fs_to_clone:
        class_id = fs["class_id"]
        if class_id not in classes_with_2026:
            # Clone for 2026-27
            clone_payload = {
                "class_id": class_id,
                "academic_year": "2026-27",
                "term1_fee": fs["term1_fee"],
                "term2_fee": fs["term2_fee"],
                "term3_fee": fs["term3_fee"],
                "books_fee": fs["books_fee"],
                "transport_monthly_fee": fs["transport_monthly_fee"]
            }
            supabase.table("fee_structure").insert(clone_payload).execute()
            cloned_count += 1
    print(f"Cloned {cloned_count} fee structure records for academic year '2026-27'.")
except Exception as e:
    print("Failed to clone fee structures:", e)

# 4. Create a new active student in Class 1 (or any class)
try:
    # Find Class 1 or Nursery ID
    classes_res = supabase.table("classes").select("*").execute()
    classes = classes_res.data
    
    # Try to find Class 1
    class_1 = next((c for c in classes if "Class 1" in c["name"]), None)
    if not class_1 and classes:
        class_1 = classes[0]
        
    if class_1:
        class_id = class_1["id"]
        class_name = class_1["name"]
        print(f"Creating a new student in class '{class_name}'...")
        
        # Fetch fee structure of this class to assign default fees to the student
        fs_res = supabase.table("fee_structure").select("*").eq("class_id", class_id).eq("academic_year", "2026-27").execute()
        
        t1, t2, t3, books = 10000.0, 10000.0, 10000.0, 3000.0
        if fs_res.data:
            fs = fs_res.data[0]
            t1 = float(fs.get("term1_fee") or 10000.0)
            t2 = float(fs.get("term2_fee") or 10000.0)
            t3 = float(fs.get("term3_fee") or 10000.0)
            books = float(fs.get("books_fee") or 3000.0)
            
        student_payload = {
            "admission_number": "20260001",
            "full_name": "ADARSH KUMAR",
            "class_id": class_id,
            "father_name": "SRINIVAS KUMAR",
            "father_phone": "9876543210",
            "mother_name": "LAKSHMI KUMAR",
            "mother_phone": "9876543211",
            "dob": "2020-05-15",
            "gender": "Male",
            "aadhaar": "123456789012",
            "address": "Oxford Street, Guntur, AP",
            "term1_fee": t1,
            "term2_fee": t2,
            "term3_fee": t3,
            "has_books": True,
            "books_fee": books,
            "has_transport": False,
            "transport_fee": 0.0,
            "old_dues": 0.0,
            "student_type": "new",
            "joining_date": "2026-06-01",
            "is_active": True,
            "status": "active"
        }
        
        student_res = supabase.table("students").insert(student_payload).execute()
        if student_res.data:
            print("Successfully created new student:")
            print(f"  Name: {student_res.data[0]['full_name']}")
            print(f"  Admission Number: {student_res.data[0]['admission_number']}")
            print(f"  Class ID: {student_res.data[0]['class_id']}")
        else:
            print("Failed to insert student record.")
    else:
        print("No classes found in the database. Cannot create a student.")
except Exception as e:
    print("Failed to create student:", e)

print("DB wipe and setup completed.")
