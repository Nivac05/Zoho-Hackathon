import requests

API_URL = "http://127.0.0.1:5001"

def test_register():
    print("Testing Registration...")
    res = requests.post(f"{API_URL}/api/register", json={
        "username": "test_user123",
        "password": "password",
        "role": "lender"
    })
    print("Register Status:", res.status_code)
    try:
        print("Register Response:", res.json())
    except:
        print(res.text)

    print("Testing Login...")
    res = requests.post(f"{API_URL}/api/login", json={
        "username": "test_user123",
        "password": "password"
    })
    print("Login Status:", res.status_code)
    data = res.json()
    print("Login Response:", data)
    
    if data.get("success"):
        token = data["token"]
        print("Testing Lender Station Registration...")
        # Now try to register a station
        res = requests.post(f"{API_URL}/api/lenders/register", json={
            "name": "Test Station",
            "location": "ECR",
            "address": "123 Test St, Chennai, India",
            "lat": 13.123,
            "lng": 80.123,
            "connector": "CCS2",
            "power": "50kW"
        }, headers={"Authorization": f"Bearer {token}"})
        print("Station Reg Status:", res.status_code)
        print("Station Reg Response:", res.json())

if __name__ == "__main__":
    test_register()
