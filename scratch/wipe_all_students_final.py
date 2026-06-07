import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

print("Wiping all remaining students...")
try:
    # Delete student payments and accessory fees first
    supabase.table("student_accessory_fees").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    supabase.table("attendance_records").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    
    # Delete students
    res = supabase.table("students").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    print(f"Successfully deleted {len(res.data) if res.data else 0} students. Active student count is now 0.")
except Exception as e:
    print("Failed to delete students:", e)
