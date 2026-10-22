import requests
import json

API_URL = "http://127.0.0.1:5000"

print("Trying login...")
try:
    res = requests.post(f"{API_URL}/api/login", json={
        "username": "test_user123",
        "password": "password"
    }, timeout=15)
    print("Status:", res.status_code)
    print("Data:", res.json())
except Exception as e:
    print("Error:", e)
