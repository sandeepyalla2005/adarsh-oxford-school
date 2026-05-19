import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not url or not service_key:
    print("Missing Supabase URL or Service Role Key")
    exit(1)

supabase = create_client(url, service_key)

users_to_reset = [
    {"email": "feeincharge@adarshoxford.com", "id": "8a274d46-94ef-4ae7-99a9-e5748fd26e52"}
]

print("Resetting passwords...")
for user in users_to_reset:
    try:
        res = supabase.auth.admin.update_user_by_id(
            user["id"],
            {"password": "password123"}
        )
        print(f"Successfully reset password for {user['email']}!")
    except Exception as e:
        print(f"Failed to reset password for {user['email']}: {e}")
