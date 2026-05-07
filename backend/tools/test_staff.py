import os
from supabase import create_client

url = os.environ.get("VITE_SUPABASE_URL", "https://dakdpmprzumtwyjshgap.supabase.co")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s")

supabase = create_client(url, key)

print("Fetching staff roles...")
try:
    response = supabase.table("user_roles").select("*").eq("role", "staff").execute()
    for row in response.data:
        # get email from profiles
        profile = supabase.table("profiles").select("*").eq("user_id", row['user_id']).execute()
        email = profile.data[0]['email'] if profile.data else "No profile email"
        print(f"Staff User: {email}")
except Exception as e:
    print("Error:", e)
