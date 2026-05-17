import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get('VITE_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print("Missing Supabase credentials")
    exit(1)

supabase = create_client(url, key)

try:
    # Join profiles and user_roles to find staff
    # Note: we can't do direct joins easily in Supabase client without a view, 
    # so we'll fetch both and combine.
    
    roles_res = supabase.table('user_roles').select('user_id, role').eq('role', 'staff').execute()
    staff_ids = [r['user_id'] for r in roles_res.data]
    
    if not staff_ids:
        print("No users found with 'staff' role.")
    else:
        profiles_res = supabase.table('profiles').select('email, full_name, user_id').in_('user_id', staff_ids).execute()
        print("Staff Accounts Found:")
        for p in profiles_res.data:
            print(f"- {p['full_name']} ({p['email']})")

    # Also check for feeInCharge as requested before
    roles_res = supabase.table('user_roles').select('user_id, role').eq('role', 'feeInCharge').execute()
    fee_ids = [r['user_id'] for r in roles_res.data]
    if fee_ids:
        profiles_res = supabase.table('profiles').select('email, full_name, user_id').in_('user_id', fee_ids).execute()
        print("\nFee In-Charge Accounts Found:")
        for p in profiles_res.data:
            print(f"- {p['full_name']} ({p['email']})")

except Exception as e:
    print(f"Error: {e}")
