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

admins = [
    {"email": "admin@adarshoxford.com", "id": "ab9e1494-da0e-476a-b0cb-48f270cc023e"},
    {"email": "sandeep.yalla506@gmail.com", "id": "047e18d1-6cd6-4ea8-a44a-dc8209853ece"},
    {"email": "sandeep@admin.com", "id": "b7ed07bd-483d-481f-8297-335779b5532f"},
    {"email": "adarsh_admin@adarshoxford.com", "id": "2fc329cc-e338-4659-8a59-2246d952d14f"},
]

for admin in admins:
    print(f"Updating password for {admin['email']}...")
    try:
        res = supabase.auth.admin.update_user_by_id(admin["id"], {"password": "AdminPassword123!"})
        print(f"SUCCESS: {admin['email']} password updated to AdminPassword123!")
    except Exception as e:
        print(f"FAILED for {admin['email']}: {e}")
