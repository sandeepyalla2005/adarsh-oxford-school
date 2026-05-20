import os
import requests
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("Missing Supabase credentials.")
    exit(1)

# Login to Supabase to get user session token
import httpx
login_url = f"{url}/auth/v1/token?grant_type=password"
headers = {
    "apikey": key,
    "Content-Type": "application/json"
}
payload = {
    "email": "admin@adarshoxford.com",
    "password": "Sandeepadmin@143"
}

resp = httpx.post(login_url, json=payload, headers=headers)
if resp.status_code != 200:
    print(f"Failed to login: {resp.status_code} {resp.text}")
    exit(1)

token = resp.json()["access_token"]

# Query the running API
api_url = "http://localhost:8000/api/class-students?class_name=all"
api_headers = {
    "Authorization": f"Bearer {token}"
}

api_resp = httpx.get(api_url, headers=api_headers)
if api_resp.status_code != 200:
    print(f"API Error: {api_resp.status_code} {api_resp.text}")
    exit(1)

students = api_resp.json()
print(f"Successfully fetched {len(students)} students from live API.")

dropouts = [s for s in students if s.get("status") == "dropout" or not s.get("is_active")]
print(f"Total dropouts/inactive students: {len(dropouts)}")
for d in dropouts:
    print(f"- Name: {d.get('full_name')}, Class ID: {d.get('class_id')}, Classes Rel: {d.get('classes')}")
