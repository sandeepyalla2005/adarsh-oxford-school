import os
from supabase import create_client
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

supabase = create_client(url, key)

try:
    res = supabase.table("left_student_fee_records").select("*").limit(1).execute()
    if res.data:
        print("Columns in 'left_student_fee_records':", sorted(res.data[0].keys()))
    else:
        # If no data exists, try to insert a dummy row or fetch schema info
        print("No rows in 'left_student_fee_records' to inspect columns directly.")
except Exception as e:
    print("Error querying left_student_fee_records:", e)
