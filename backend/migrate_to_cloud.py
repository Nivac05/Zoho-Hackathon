import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LENDERS_FILE = os.path.join(BASE_DIR, "..", "frontend", "src", "data", "lenders.json")
DOTENV_PATH = os.path.join(BASE_DIR, ".env")

load_dotenv(DOTENV_PATH)

def migrate():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        print("❌ MONGO_URI not found in .env")
        return

    try:
        # Load JSON data
        with open(LENDERS_FILE, 'r') as f:
            data = json.load(f)
        
        # Connect to Mongo
        client = MongoClient(mongo_uri)
        db = client.get_database()
        lenders_col = db["lenders"]
        
        # Clear existing
        lenders_col.delete_many({})
        
        # Flatten and insert
        all_lenders = []
        for location, stations in data.items():
            for station in stations:
                station["location"] = location # Ensure location is part of the doc
                all_lenders.append(station)
                
        if all_lenders:
            lenders_col.insert_many(all_lenders)
            print(f"✅ Successfully migrated {len(all_lenders)} stations to Cloud MongoDB!")
        else:
            print("⚠️ No data found to migrate.")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")

if __name__ == "__main__":
    migrate()
