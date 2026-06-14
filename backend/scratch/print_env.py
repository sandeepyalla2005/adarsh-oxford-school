import os
for k, v in os.environ.items():
    if any(x in k.lower() for x in ["pass", "secret", "key", "url", "db", "postgres"]):
        # Mask sensitive values slightly but show enough to verify
        print(f"{k} = {v[:10]}... (length={len(v)})" if v else f"{k} = [empty]")
