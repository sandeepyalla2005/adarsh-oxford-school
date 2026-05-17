import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing environment variables")
    exit(1)

supabase = create_client(url, key)

print("--- SCHOOL SETTINGS ---")
settings = supabase.table("school_settings").select("*").execute()
if settings.data:
    for k, v in settings.data[0].items():
        print(f"{k}: {v}")
else:
    print("No settings found")

print("\n--- CLASSES ---")
classes = supabase.table("classes").select("*").order("sort_order").execute()
for c in classes.data:
    print(f"ID: {c['id']}, Name: {c['name']}")

print("\n--- CURRENT FEE STRUCTURE (2026-27) ---")
fees = supabase.table("fee_structure").select("*").eq("academic_year", "2026-27").execute()
for f in fees.data:
    print(f)
