import threading
import requests
import time

BASE_URL = "http://127.0.0.1:5000"

def get_auth_token(username, password):
    resp = requests.post(f"{BASE_URL}/api/login", json={"username": username, "password": password})
    if resp.status_code == 200:
        return resp.json().get("token")
    raise Exception(f"Failed to log in as {username}: {resp.text}")

def attempt_hold(token, user_label, results):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "station_id": "st_ecr",
        "plug_id": "pl_ecr_1",
        "date": "2026-11-01",
        "start_time": "14:00",
        "duration": 1.0,
        "location": "ECR"
    }
    resp = requests.post(f"{BASE_URL}/api/slots/hold", json=payload, headers=headers)
    results.append({
        "user": user_label,
        "status_code": resp.status_code,
        "data": resp.json()
    })

def test_simultaneous_holds():
    print("=== Testing Concurrency Lock on Shared Plug Slot ===")
    
    # 1. Login Driver 1 and Driver 2
    token1 = get_auth_token("driver1", "password123")
    token2 = get_auth_token("driver2", "password123")
    print("[PASS] Authenticated both Driver 1 and Driver 2.")

    results = []
    # 2. Spawn two simultaneous threads competing for the exact same slot
    start_event = threading.Event()

    th1 = threading.Thread(target=lambda: (start_event.wait(), attempt_hold(token1, "Driver 1", results)))
    th2 = threading.Thread(target=lambda: (start_event.wait(), attempt_hold(token2, "Driver 2", results)))

    th1.start()
    th2.start()
    time.sleep(0.05)  # Align both threads
    start_event.set() # Trigger simultaneously

    th1.join()
    th2.join()

    print("\n--- Concurrency Test Results ---")
    for r in results:
        print(f"[{r['user']}] HTTP Status: {r['status_code']} -> {r['data']}")

    status_codes = [r["status_code"] for r in results]
    
    # Assert exactly 1 succeeded (200) and 1 failed with Conflict (409)
    assert status_codes.count(200) == 1, f"Expected exactly 1 successful hold (200), got: {status_codes}"
    assert status_codes.count(409) == 1, f"Expected exactly 1 conflict rejection (409), got: {status_codes}"

    print("\n[SUCCESS] CONCURRENCY PROOF VERIFIED: Exactly one driver successfully held the slot, preventing double booking!")

if __name__ == "__main__":
    test_simultaneous_holds()
