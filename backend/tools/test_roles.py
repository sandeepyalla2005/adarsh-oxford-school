import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('d:/school-fee-mangament system (3)/adarsh-oxford/backend/.env')
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
supabase: Client = create_client(url, key)

roles_to_try = ["feeInCharge", "fee_in_charge", "fee_incharge", "fee", "FeeInCharge", "fee_admin"]

# User ID from previous tests
user_id = "5ef6ffa2-6fa8-4b65-9756-22e777d7c6e4"

for role in roles_to_try:
    print(f"Trying role: {role}")
    try:
        supabase.from_("user_roles").update({"role": role}).eq("user_id", user_id).execute()
        print(f"SUCCESS assigned role: {role}")
        break
    except Exception as e:
        err_str = str(e)
        if "invalid input value for enum app_role" in err_str:
            print(f"INVALID: {role}")
        else:
            print(f"ERROR for {role}: {err_str}")
