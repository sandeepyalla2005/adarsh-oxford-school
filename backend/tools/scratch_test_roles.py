
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv('d:/school-fee-mangament system (3)/adarsh-oxford/backend/.env')
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
supabase: Client = create_client(url, key)

roles_to_try = ["feeInCharge", "fee_in_charge", "fee_incharge", "fee", "FeeInCharge", "fee_admin"]

# Get Sandeep's ID first from test_all.py we know it exists
for role in roles_to_try:
    print(f"Trying role: {role}...")
    try:
        supabase.from_("user_roles").update({"role": role}).eq("user_id", "5ef6ffa2-6fa8-4b65-9756-22e777d7c6e4").execute()
        print(f"SUCCESSFULLY assigned role: {role}")
        break
    except Exception as e:
        print(f"Error for {role}: {e}")
