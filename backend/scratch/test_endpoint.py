import os
import asyncio
from dotenv import load_dotenv

# Load env variables
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from main import get_class_students

# Mock user dependency
class MockUser:
    id = "ab9e1494-da0e-476a-b0cb-48f270cc023e"
    role = "admin"

async def test():
    user = MockUser()
    # Call the endpoint directly
    res = get_class_students(class_name="all", user=user)
    print(f"Total students returned: {len(res)}")
    if len(res) > 0:
        first = res[0]
        print("Keys in student dict:", list(first.keys()))
        print("Classes key value:", first.get("classes"))
        
        # Check if there are dropout students and print their info
        dropouts = [s for s in res if s.get("status") == "dropout" or not s.get("is_active")]
        print(f"Total dropout/inactive students in API response: {len(dropouts)}")
        if dropouts:
            print("First dropout student classes info:", dropouts[0].get("full_name"), "-> classes:", dropouts[0].get("classes"))
            print("All dropouts class names:")
            for d in dropouts:
                print(f"- {d.get('full_name')}: classes = {d.get('classes')}, class_id = {d.get('class_id')}")

if __name__ == "__main__":
    asyncio.run(test())
