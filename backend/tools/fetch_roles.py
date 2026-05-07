import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('d:/school-fee-mangament system (3)/adarsh-oxford/backend/.env')
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
supabase: Client = create_client(url, key)

print("Fetching existing user roles...")
try:
    res = supabase.from_("user_roles").select("role").limit(10).execute()
    roles = set(r['role'] for r in res.data)
    print(f"Roles found in DB: {roles}")
except Exception as e:
    print(f"Error fetching roles: {e}")
