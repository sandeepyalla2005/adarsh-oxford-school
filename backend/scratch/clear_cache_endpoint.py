import urllib.request
import json

url = "http://localhost:8000/api/students/clear-cache"
req = urllib.request.Request(url, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode("utf-8"))
        print("Cache clear response:", res_data)
except Exception as e:
    print("Error clearing cache:", e)
