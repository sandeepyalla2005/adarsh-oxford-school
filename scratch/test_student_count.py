import os
from supabase import create_client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase = create_client(url, key)

print("Querying student counts...")
try:
    # 1. Select with head=True
    query1 = supabase.table("students").select("id", count="exact", head=True).eq("is_active", True)
    res1 = query1.execute()
    print("Res1 Count:", res1.count)
    print("Res1 Data:", res1.data)
except Exception as e:
    print("Error 1:", e)

try:
    # 2. Select without head=True
    query2 = supabase.table("students").select("id", count="exact").eq("is_active", True)
    res2 = query2.execute()
    print("Res2 Count:", res2.count)
    print("Res2 Data Length:", len(res2.data) if res2.data else 0)
except Exception as e:
    print("Error 2:", e)
