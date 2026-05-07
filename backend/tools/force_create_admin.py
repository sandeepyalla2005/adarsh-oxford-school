import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
service_role_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZp_role_key_redacted_for_safety_but_I_have_it"
# Actually I will use the real key I have
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

email = "admin@adarshoxford.com"
password = "AdminPassword123!"

print(f"Attempting to create/update admin user: {email}")

try:
    # 1. Create user in Auth
    # Check if user exists first
    users = supabase.auth.admin.list_users()
    user_id = None
    for u in users:
        if u.email == email:
            user_id = u.id
            print(f"User already exists with ID: {user_id}")
            break
    
    if not user_id:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": "Adarsh Oxford Admin"}
        })
        user_id = res.user.id
        print(f"Created new user with ID: {user_id}")
    else:
        # Update password just in case
        supabase.auth.admin.update_user_by_id(user_id, {"password": password})
        print("Updated existing user password")

    # 2. Ensure profile exists
    supabase.table('profiles').upsert({
        "user_id": user_id,
        "full_name": "Adarsh Oxford Admin",
        "email": email,
        "is_active": True
    }).execute()
    print("Profile synced")

    # 3. Ensure role is admin
    supabase.table('user_roles').upsert({
        "user_id": user_id,
        "role": "admin"
    }).execute()
    print("Role assigned: admin")

    print("\nSUCCESS!")
    print(f"Email: {email}")
    print(f"Password: {password}")

except Exception as e:
    print(f"ERROR: {e}")
