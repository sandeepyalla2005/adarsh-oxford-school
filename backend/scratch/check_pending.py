import requests

try:
    response = requests.get('http://localhost:8000/api/class-students?class_name=all')
    if response.status_code == 200:
        data = response.json()
        pending = [s for s in data if s.get('status') == 'dropout_pending']
        if pending:
            print(pending[0])
        else:
            print("No pending requests")
    else:
        print(f"Error: {response.status_code}")
except Exception as e:
    print(f"Failed: {e}")
