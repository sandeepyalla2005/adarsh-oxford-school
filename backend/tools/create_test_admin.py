import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZp_role_key_redacted"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

new_email = "oxford_admin_test@adarshoxford.com"
password = "TestAdminPassword123!"

print(f"Creating fresh test admin: {new_email}")

try:
    # 1. Create User
    res = supabase.auth.admin.create_user({
        "email": new_email,
        "password": password,
        "email_confirm": True
    })
    user_id = res.user.id
    print(f"User created: {user_id}")

    # 2. Sync Profile
    supabase.table('profiles').upsert({
        "user_id": user_id,
        "full_name": "Test Admin",
        "email": new_email,
        "is_active": True
    }).execute()
    
    # 3. Assign Role
    supabase.table('user_roles').upsert({
        "user_id": user_id,
        "role": "admin"
    }).execute()

    print("SUCCESS! Test Admin Created.")
except Exception as e:
    print(f"FAILED: {e}")
