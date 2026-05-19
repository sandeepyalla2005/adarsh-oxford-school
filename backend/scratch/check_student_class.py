import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing environment variables.")
    exit(1)

supabase = create_client(url, key)

try:
    res = supabase.table("students").select("full_name, classes(name)").limit(5).execute()
    print("Students with classes(name) using ANON key:")
    for row in res.data:
        print(row)
except Exception as e:
    print("Error:", e)
