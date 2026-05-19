import os
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

try:
    # Get all classes
    cls_res = supabase.table("classes").select("*").execute()
    classes = {c["id"]: c["name"] for c in cls_res.data}
    
    # Get count of students per class
    stud_res = supabase.table("students").select("class_id").execute()
    counts = {}
    for student in stud_res.data:
        cid = student.get("class_id")
        counts[cid] = counts.get(cid, 0) + 1
        
    print("Student count per class:")
    for cid, name in classes.items():
        print(f"{name}: {counts.get(cid, 0)}")
except Exception as e:
    print("Error:", e)
