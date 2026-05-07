import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
# Using the service role key I found earlier in .env
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

# Query triggers
try:
    res = supabase.rpc('get_triggers', {}).execute()
    print("Triggers:", res.data)
except Exception as e:
    print("RPC get_triggers failed, trying raw query via dashboard is better but I will try to list tables first")
    try:
        res = supabase.table('profiles').select('*').limit(1).execute()
        print("Profiles access:", "OK" if res.data else "Empty")
    except Exception as e2:
        print("Profiles access failed:", e2)
