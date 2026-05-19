import os
import random
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing environment variables.")
    exit(1)

supabase = create_client(url, key)

first_names = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Krishna", "Ishaan", "Shaurya", "Pranav", "Aryan",
               "Diya", "Ananya", "Aadhya", "Priya", "Saanvi", "Riya", "Kavya", "Ira", "Myra", "Siddhi"]
last_names = ["Kumar", "Sharma", "Verma", "Reddy", "Patel", "Singh", "Joshi", "Rao", "Gupta", "Yadav"]

def generate_student(class_id, class_name, index):
    gender = random.choice(["Male", "Female"])
    first = random.choice(first_names)
    last = random.choice(last_names)
    full_name = f"{first} {last}"
    
    adm_num = f"ADM-{class_name.upper().replace(' ', '')}-{index:03d}"
    roll_num = str(100 + index)
    father_name = f"{random.choice(first_names)} {last}"
    mother_name = f"{random.choice(first_names)} {last}"
    
    # Phone
    father_phone = f"{random.randint(6000000000, 9999999999)}"
    mother_phone = f"{random.randint(6000000000, 9999999999)}"
    
    # DOB (approx age based on class)
    if "nursery" in class_name.lower() or "pre-primary" in class_name.lower():
        age = 3
    elif "lkg" in class_name.lower():
        age = 4
    elif "ukg" in class_name.lower():
        age = 5
    elif "10" in class_name:
        age = 15
    else:
        age = 10
        
    dob = (datetime.now() - timedelta(days=365 * age + random.randint(0, 300))).strftime("%Y-%m-%d")
    joining_date = "2025-06-01"
    
    # Fee details
    term1 = float(random.choice([10000, 12000, 15000]))
    term2 = float(random.choice([10000, 11000, 14000]))
    term3 = float(random.choice([10000, 11000, 14000]))
    has_books = random.choice([True, False])
    books_fee = 2500.0 if has_books else 0.0
    has_transport = random.choice([True, False])
    transport_fee = 4500.0 if has_transport else 0.0
    old_dues = float(random.choice([0, 0, 0, 1500, 3000]))
    
    return {
        "admission_number": adm_num,
        "full_name": full_name,
        "class_id": class_id,
        "roll_number": roll_num,
        "gender": gender,
        "father_name": father_name,
        "father_phone": father_phone,
        "mother_name": mother_name,
        "mother_phone": mother_phone,
        "dob": dob,
        "aadhaar": f"{random.randint(1000, 9999)}{random.randint(1000, 9999)}{random.randint(1000, 9999)}",
        "address": f"Plot {random.randint(1, 200)}, Oxford Road, Hyderabad",
        "term1_fee": term1,
        "term2_fee": term2,
        "term3_fee": term3,
        "has_books": has_books,
        "books_fee": books_fee,
        "has_transport": has_transport,
        "transport_fee": transport_fee,
        "old_dues": old_dues,
        "parent_email": f"parent.{index}@example.com",
        "student_type": "new" if random.choice([True, False]) else "old",
        "joining_date": joining_date,
        "is_active": True,
        "status": "active"
    }

try:
    # Get classes
    cls_res = supabase.table("classes").select("*").execute()
    classes = cls_res.data
    
    # Target empty/low classes: Nursery, LKG, Class 10, Pre-Primary
    target_classes = ["Nursery", "LKG", "Class 10", "Pre-Primary"]
    
    students_to_insert = []
    for c in classes:
        if c["name"] in target_classes:
            print(f"Generating students for class: {c['name']}")
            # Check how many currently exist
            existing = supabase.table("students").select("id").eq("class_id", c["id"]).execute()
            exist_count = len(existing.data)
            needed = 10 - exist_count
            if needed > 0:
                for idx in range(needed):
                    student = generate_student(c["id"], c["name"], idx + exist_count + 1)
                    students_to_insert.append(student)
                    
    if students_to_insert:
        print(f"Inserting {len(students_to_insert)} student records...")
        res = supabase.table("students").insert(students_to_insert).execute()
        print("Successfully seeded students!")
    else:
        print("All target classes already have at least 10 students.")
        
except Exception as e:
    print("Error:", e)
