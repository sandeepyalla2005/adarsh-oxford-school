import os
from supabase import create_client
from dotenv import load_dotenv

# Use absolute path to be sure
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

if not url or not key:
    print(f"Missing environment variables. URL: {url}, KEY: {'set' if key else 'None'}")
    exit(1)

supabase = create_client(url, key)

tables = ["accessory_fees", "transport_fees", "books_fees", "registration_fees"]
for table in tables:
    try:
        # Check if table exists by trying to select
        res = supabase.table(table).select("*").limit(1).execute()
        print(f"Table {table}: EXISTS")
    except Exception as e:
        print(f"Table {table}: MISSING or ERROR")
