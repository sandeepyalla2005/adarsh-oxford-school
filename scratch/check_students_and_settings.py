import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

# Check classes
classes = supabase.table("classes").select("id, name").execute()
print(f"Classes (Total: {len(classes.data)}):")
for c in classes.data[:5]:
    print(f"  Class: {c['name']} (ID: {c['id']})")

# Check students
students = supabase.table("students").select("id, full_name, admission_number, class_id").execute()
print(f"\nStudents (Total: {len(students.data)}):")
for s in students.data[:5]:
    print(f"  Student: {s['full_name']} (Adm: {s['admission_number']})")

# Check school settings
settings = supabase.table("school_settings").select("*").execute()
print(f"\nSchool Settings:")
for row in settings.data:
    print(row)
