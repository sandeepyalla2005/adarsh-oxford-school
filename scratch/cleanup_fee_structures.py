import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

print("Starting fee structure cleanup...")
try:
    res = supabase.table("fee_structure").delete().in_("academic_year", ["2031-32", "2031-2032"]).execute()
    print(f"Deleted {len(res.data) if res.data else 0} legacy fee structure records.")
except Exception as e:
    print("Failed to delete legacy fee structures:", e)
