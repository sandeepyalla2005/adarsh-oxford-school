import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

res = supabase.table("fee_structure").select("*").execute()
print(f"Fee Structures (Total: {len(res.data)}):")
years = set(r.get("academic_year") for r in res.data)
print("Configured Academic Years:", years)

for r in res.data[:5]:
    print(r)
