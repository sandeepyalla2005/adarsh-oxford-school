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
    # Query user_roles table
    res = supabase.table("user_roles").select("*").execute()
    print("User Roles:")
    for row in res.data:
        print(row)
    
    # Query profiles table
    res_profiles = supabase.table("profiles").select("*").execute()
    print("\nProfiles:")
    for row in res_profiles.data:
        print(row)
except Exception as e:
    print("Error:", e)
