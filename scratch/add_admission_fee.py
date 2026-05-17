import os
from supabase import create_client, Client

url = "https://dakdpmprzumtwyjshgap.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

supabase: Client = create_client(url, key)

def add_category():
    category_name = "Admission Fee"
    default_price = 1000  # Defaulting to 1000, user can change later
    
    # Check if exists
    res = supabase.table("accessory_categories").select("*").ilike("name", category_name).execute()
    if res.data:
        print(f"Category '{category_name}' already exists.")
        return

    data = {
        "name": category_name,
        "default_price": default_price,
        "is_active": True
    }
    
    res = supabase.table("accessory_categories").insert(data).execute()
    print(f"Added category: {res.data}")

if __name__ == "__main__":
    add_category()
