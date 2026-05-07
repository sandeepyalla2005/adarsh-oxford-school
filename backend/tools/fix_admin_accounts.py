import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

def fix_user(email, password):
    print(f"Fixing user: {email}")
    try:
        users = supabase.auth.admin.list_users()
        target_user = None
        for u in users:
            if u.email == email:
                target_user = u
                break
        
        if target_user:
            print(f"Deleting corrupted user: {target_user.id}")
            # Delete from roles and profiles first to be safe
            supabase.table('user_roles').delete().eq('user_id', target_user.id).execute()
            supabase.table('profiles').delete().eq('user_id', target_user.id).execute()
            # Delete from auth
            supabase.auth.admin.delete_user(target_user.id)
        
        # Create fresh
        print(f"Creating fresh user: {email}")
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": "Adarsh Admin"}
        })
        user_id = res.user.id
        
        # Sync profile
        supabase.table('profiles').upsert({
            "user_id": user_id,
            "full_name": "Adarsh Admin",
            "email": email,
            "is_active": True
        }).execute()
        
        # Assign role
        supabase.table('user_roles').upsert({
            "user_id": user_id,
            "role": "admin"
        }).execute()
        
        print(f"SUCCESS: {email} is now active with password: {password}")
    except Exception as e:
        print(f"FAILED to fix {email}: {e}")

# Fix both mentioned emails
# The user sent 665464646 - I will use it as the password
fix_user("admin@adarshoxford.com", "665464646")
fix_user("sandeep@admin.com", "665464646")
