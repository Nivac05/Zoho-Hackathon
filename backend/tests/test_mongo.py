import pymongo
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, "backend", ".env"), override=True)

uri = os.getenv("MONGO_URI")
print("URI:", uri)

try:
    print("Testing Atlas Connection...")
    client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=3000)
    print("Databases:", client.list_database_names())
except Exception as e:
    print("Connection Failed:", e)
