import os
import sys
import logging

# Set up logging to stdout
logging.basicConfig(level=logging.INFO)

# Add backend folder to system path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

# Set env variables
os.environ["VITE_SUPABASE_URL"] = "https://dakdpmprzumtwyjshgap.supabase.co"
os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRha2RwbXByenVtdHd5anNoZ2FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyMjE1NSwiZXhwIjoyMDg1Nzk4MTU1fQ.8gzt3uaYthvF7AbGFlKegwOn88JHdkYgyfAjFZaxw2s"

import main

print("Running refresh_dashboard_stats_task()...")
try:
    main.refresh_dashboard_stats_task()
    print("Done!")
    # Load and print stats.json contents
    stats_data = main.load_stats_from_disk()
    import pprint
    pprint.pprint(stats_data)
except Exception as e:
    print("Error:", e)
    import traceback
    traceback.print_exc()
