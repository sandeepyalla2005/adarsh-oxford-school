import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

print("Listing all users and their details...")
try:
    roles = supabase.table("user_roles").select("*").execute()
    profiles = supabase.table("profiles").select("*").execute()
    
    profile_map = {p['user_id']: p for p in profiles.data}
    
    for r in roles.data:
        uid = r['user_id']
        role = r['role']
        profile = profile_map.get(uid, {})
        email = profile.get('email', 'No email')
        name = profile.get('full_name', 'No name')
        designation = profile.get('designation', 'No designation')
        print(f"ID: {uid} | Email: {email} | Role: {role} | Designation: {designation}")
        
except Exception as e:
    print(f"Error: {e}")
