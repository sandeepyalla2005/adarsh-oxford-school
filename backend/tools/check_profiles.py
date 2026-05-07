import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('d:/school-fee-mangament system (3)/adarsh-oxford/backend/.env')
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
supabase: Client = create_client(url, key)

print("Fetching profiles schema info...")
try:
    res = supabase.from_("profiles").select("*").limit(1).execute()
    if res.data:
        print(f"Columns in profiles: {res.data[0].keys()}")
    else:
        print("No profiles found.")
except Exception as e:
    print(f"Error: {e}")
