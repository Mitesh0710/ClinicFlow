from pymongo import MongoClient, ASCENDING
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = MongoClient(MONGO_URI)
db = client["clinicflow"]

users_col = db["users"]
appointments_col = db["appointments"]
unavailable_col = db["unavailable_dates"]

users_col.create_index([("email", ASCENDING)], unique=True)
appointments_col.create_index([("doctor_id", ASCENDING), ("date", ASCENDING), ("time", ASCENDING)])
appointments_col.create_index([("status", ASCENDING)])
unavailable_col.create_index([("doctor_id", ASCENDING), ("date", ASCENDING)], unique=True)