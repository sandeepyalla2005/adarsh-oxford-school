import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

user_id = "0f1c302d-a906-4259-8d24-7d7d80ac7c27"
email = "Oxford@feeincharge.com"
new_password = "665464646"

print(f"Resetting password for {email} ({user_id}) to {new_password}...")

try:
    # Update password using admin API
    supabase.auth.admin.update_user_by_id(user_id, {"password": new_password})
    print("SUCCESS! Password updated.")
    
except Exception as e:
    print(f"FAILED: {e}")
