import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

# Helper to execute try-deletes
def try_delete_students():
    try:
        res = supabase.table("students").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        print("Successfully deleted students:", len(res.data))
        return True, None
    except Exception as e:
        return False, str(e)

success, err = try_delete_students()
if not success:
    print("Delete failed with error:", err)
