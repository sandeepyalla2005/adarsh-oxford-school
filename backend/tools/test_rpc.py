import os
import requests
from dotenv import load_dotenv

load_dotenv('d:/school-fee-mangament system (3)/adarsh-oxford/backend/.env')

url = os.environ.get("VITE_SUPABASE_URL", "https://dakdpmprzumtwyjshgap.supabase.co")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

if not key:
    print("Error: VITE_SUPABASE_PUBLISHABLE_KEY not found in .env")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

# Test if get_user_roles exists
r = requests.post(f"{url}/rest/v1/rpc/get_user_roles", headers=headers, json={"p_user_id": "00000000-0000-0000-0000-000000000000"})
print(f"Status: {r.status_code}")
print(f"Response: {r.text}")
