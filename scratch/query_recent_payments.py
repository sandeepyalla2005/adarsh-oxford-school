import os
from supabase import create_client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase = create_client(url, key)

print("Querying 10 most recent course payments...")
res = supabase.table("course_payments").select("*, students(full_name, term1_fee, term2_fee, term3_fee)").order("created_at", desc=True).limit(10).execute()
for r in res.data:
    student = r.get("students", {}) or {}
    print(f"ID: {r.get('id')}, Date: {r.get('payment_date')}, Term: {r.get('term')}, Paid: {r.get('amount_paid')}, Student: {student.get('full_name')}, T1 Fee: {student.get('term1_fee')}, T2 Fee: {student.get('term2_fee')}, T3 Fee: {student.get('term3_fee')}")
