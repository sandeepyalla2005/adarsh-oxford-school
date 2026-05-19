import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not url or not service_key:
    print("Missing Supabase URL or Service Role Key")
    exit(1)

supabase = create_client(url, service_key)

# Query pg_policies to see what policies are active on the 'students' table
try:
    res = supabase.postgrest.rpc("get_policies", {}).execute()
    print("RPC Result:", res.data)
except Exception as e:
    # If RPC doesn't exist, we can run a custom query or try selecting directly
    print("RPC failed, trying raw query...")
    try:
        # Let's try running a simple select on a system table or execute SQL if possible
        # Since standard postgrest doesn't let us run arbitrary SQL unless an RPC is defined,
        # we can check what tables exist or check if we can write to students
        print("Checking if we can update students table with service role...")
        # Get one student
        student_res = supabase.table("students").select("id, full_name").limit(1).execute()
        if student_res.data:
            print("Found a student:", student_res.data[0])
        else:
            print("No students found.")
    except Exception as ex:
        print("Error:", ex)
