import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    res = supabase.table("pg_proc").select("*").limit(1).execute()
    print("Success pg_proc:", res.data)
except Exception as e:
    print("Failed pg_proc:", e)
