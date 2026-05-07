import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

try:
    # Try to query a public table
    res = supabase.table('classes').select('name').limit(1).execute()
    print("Classes query success:", res.data)
except Exception as e:
    print("Classes query failed:", e)

try:
    # Try to run a raw SQL query via RPC if it exists
    # Usually Supabase has a 'exec_sql' RPC if users set it up, but unlikely here.
    # We will try to list schemas if possible
    pass
except Exception as e:
    print("Schema check failed:", e)
