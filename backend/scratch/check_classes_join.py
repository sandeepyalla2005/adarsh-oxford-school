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
    res = supabase.table("students").select("id, full_name, class_id, classes(name), is_active, status").eq("is_active", False).execute()
    print(f"Found {len(res.data)} inactive students.")
    for row in res.data[:20]:
        print(f"Student: {row.get('full_name')} | Class ID: {row.get('class_id')} | Classes Join: {row.get('classes')} | Status: {row.get('status')}")
except Exception as e:
    print("Error:", e)
