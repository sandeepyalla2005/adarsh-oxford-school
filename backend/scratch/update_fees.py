import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

supabase = create_client(url, key)

# Get classes to map names to IDs
classes_res = supabase.table("classes").select("*").execute()
class_map = {c["name"]: c["id"] for c in classes_res.data}

if "Pre-Primary" not in class_map:
    print("Creating Pre-Primary class...")
    new_class = supabase.table("classes").insert({"name": "Pre-Primary", "sort_order": -1}).execute()
    if new_class.data:
        class_map["Pre-Primary"] = new_class.data[0]["id"]
        print(f"Created Pre-Primary with ID: {class_map['Pre-Primary']}")

# Add standard variations
class_map["PRE-PRIMARY"] = class_map.get("Pre-Primary")
class_map["I STD"] = class_map.get("Class 1")
class_map["II STD"] = class_map.get("Class 2")
class_map["III STD"] = class_map.get("Class 3")
class_map["IV STD"] = class_map.get("Class 4")
class_map["V STD"] = class_map.get("Class 5")
class_map["VI STD"] = class_map.get("Class 6")
class_map["VII STD"] = class_map.get("Class 7")
class_map["VIII STD"] = class_map.get("Class 8")
class_map["IX STD"] = class_map.get("Class 9")
class_map["X STD"] = class_map.get("Class 10")

fee_data = [
    {"class": "PRE-PRIMARY", "june": 9000, "sept": 8000, "dec": 8000},
    {"class": "Nursery", "june": 9000, "sept": 8000, "dec": 8000},
    {"class": "LKG", "june": 10000, "sept": 9000, "dec": 9000},
    {"class": "UKG", "june": 10000, "sept": 10000, "dec": 10000},
    {"class": "Class 1", "june": 11000, "sept": 11000, "dec": 10000},
    {"class": "Class 2", "june": 11000, "sept": 11000, "dec": 10000},
    {"class": "Class 3", "june": 12000, "sept": 12000, "dec": 11000},
    {"class": "Class 4", "june": 12000, "sept": 12000, "dec": 11000},
    {"class": "Class 5", "june": 13000, "sept": 13000, "dec": 12000},
    {"class": "Class 6", "june": 14000, "sept": 14000, "dec": 12000},
    {"class": "Class 7", "june": 14000, "sept": 14000, "dec": 12000},
    {"class": "Class 8", "june": 15000, "sept": 15000, "dec": 15000},
    {"class": "Class 9", "june": 16000, "sept": 16000, "dec": 16000},
    {"class": "Class 10", "june": 18000, "sept": 17000, "dec": 17000},
]

academic_year = "2026-27"
upserts = []

for entry in fee_data:
    class_id = class_map.get(entry["class"])
    if not class_id:
        print(f"Skipping {entry['class']} - not found")
        continue
    
    upserts.append({
        "class_id": class_id,
        "academic_year": academic_year,
        "term1_fee": entry["june"],
        "term2_fee": entry["sept"],
        "term3_fee": entry["dec"],
        "books_fee": 4000, # Using Accessories as books_fee for now or 0
        "transport_monthly_fee": 0
    })

if upserts:
    res = supabase.table("fee_structure").upsert(upserts, on_conflict="class_id,academic_year").execute()
    print(f"Upserted {len(upserts)} records")
else:
    print("No records to upsert")
