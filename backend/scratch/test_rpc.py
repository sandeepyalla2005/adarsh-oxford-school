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

user_id = "ab9e1494-da0e-476a-b0cb-48f270cc023e" # admin@adarshoxford.com

print(f"Calling RPC get_user_roles for {user_id}...")
try:
    res = supabase.rpc("get_user_roles", {"p_user_id": user_id}).execute()
    print("RPC Result:", res.data)
except Exception as e:
    print("RPC Failed:", e)
