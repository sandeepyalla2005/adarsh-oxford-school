import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

email = "Oxford@feeincharge.com"
passwords_to_try = ["665464646", "AdminPassword123!", "Oxford123!", "12345678"]

for password in passwords_to_try:
    print(f"Trying password: {password} for {email}...")
    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if res.user:
            print(f"SUCCESS! Password for {email} is: {password}")
            exit(0)
    except Exception as e:
        print(f"Failed: {e}")

print("Could not find password.")
