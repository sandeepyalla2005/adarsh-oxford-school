import os
import requests
from dotenv import load_dotenv

load_dotenv("c:/Users/darshan kumar/Downloads/adarsh-oxford (1)/adarsh-oxford/backend/.env")

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

res = requests.get(url + "/rest/v1/?select=*", headers=headers)
if res.status_code == 200:
    definitions = res.json().get("definitions", {})
    student_def = definitions.get("students", {})
    print("Students Columns:")
    for prop in student_def.get("properties", {}).keys():
        print(f"  {prop}")
else:
    print("Failed to get schema:", res.status_code, res.text)
