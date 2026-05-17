import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

#print("Listing all users from auth.users...")
#res_users = supabase.auth.admin.list_users()
#for u in res_users:
#    print(f"ID: {u.id} | Email: {u.email} | Meta: {u.user_metadata}")

print("\nListing all from user_roles...")
res_roles = supabase.table("user_roles").select("*").execute()
for r in res_roles.data:
    print(r)

print("\nListing all from profiles...")
res_profiles = supabase.table("profiles").select("*").execute()
for p in res_profiles.data:
    print(p)
