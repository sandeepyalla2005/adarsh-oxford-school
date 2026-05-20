import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

user_id = "8a274d46-94ef-4ae7-99a9-e5748fd26e52"

# Check user roles table
try:
    res = supabase.table("user_roles").select("*").eq("user_id", user_id).execute()
    print("User roles in table:", res.data)
except Exception as e:
    print("Error querying user_roles table:", e)

# Check profile table
try:
    res = supabase.table("profiles").select("*").eq("user_id", user_id).execute()
    print("User profile:", res.data)
except Exception as e:
    print("Error querying profiles table:", e)

# Test RPC call get_user_roles
try:
    res = supabase.rpc("get_user_roles", {"p_user_id": user_id}).execute()
    print("RPC get_user_roles result:", res.data)
except Exception as e:
    print("Error calling RPC get_user_roles:", e)
