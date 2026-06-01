import os
from supabase import create_client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase = create_client(url, key)

print("Querying payments for student fraheen...")
# Find fraheen's student ID first
student_res = supabase.table("students").select("id, full_name").eq("full_name", "fraheen").execute()
if not student_res.data:
    print("fraheen not found")
else:
    sid = student_res.data[0]["id"]
    print(f"Student ID: {sid}")
    payments = supabase.table("course_payments").select("*").eq("student_id", sid).order("created_at", desc=True).execute()
    for p in payments.data:
        print(f"Date: {p.get('created_at')}, Receipt: {p.get('receipt_number')}, Term: {p.get('term')}, Amount: {p.get('amount_paid')}")
