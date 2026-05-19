import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not url or not service_key:
    print("Missing Supabase URL or Service Role Key")
    exit(1)

supabase = create_client(url, service_key)

try:
    print("Fetching users from profiles...")
    res = supabase.table("profiles").select("user_id, email, full_name, designation").execute()
    print("Profiles:")
    for row in res.data or []:
        print(f"Name: {row.get('full_name')}, Email: {row.get('email')}, Designation: {row.get('designation')}, ID: {row.get('user_id')}")
        
    print("\nFetching user roles...")
    roles_res = supabase.table("user_roles").select("user_id, role").execute()
    print("Roles:")
    for row in roles_res.data or []:
        print(f"User ID: {row.get('user_id')}, Role: {row.get('role')}")
except Exception as e:
    print("Error:", e)
