from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.database import appointments_col, users_col, unavailable_col
from app.utils.auth_utils import get_current_user, require_role
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

def serialize_user(u):
    u["_id"] = str(u["_id"])
    return u

def serialize_appt(a):
    a["_id"] = str(a["_id"])
    return a

@router.get("/list")
def list_doctors(_: dict = Depends(get_current_user)):
    doctors = list(users_col.find({"role": "doctor"}, {"password": 0}))
    return [serialize_user(d) for d in doctors]

@router.get("/schedule/{doctor_id}")
def get_schedule(doctor_id: str, date: str = None, _: dict = Depends(get_current_user)):
    query = {"doctor_id": doctor_id}
    if date:
        query["date"] = date
    appts = list(appointments_col.find(query).sort("time", 1))
    return [serialize_appt(a) for a in appts]

@router.get("/today")
def today_appointments(user: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    query = {"doctor_id": user["id"], "date": today}
    appts = list(appointments_col.find(query).sort("time", 1))
    return [serialize_appt(a) for a in appts]

@router.get("/stats/{doctor_id}")
def get_stats(doctor_id: str, _: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    all_appts = list(appointments_col.find({"doctor_id": doctor_id}))
    return {
        "today": len([a for a in all_appts if a["date"] == today and a["status"] == "booked"]),
        "booked": len([a for a in all_appts if a["status"] == "booked"]),
        "completed": len([a for a in all_appts if a["status"] == "completed"]),
        "cancelled": len([a for a in all_appts if a["status"] == "cancelled"]),
    }

# ── Unavailability routes ────────────────────────────────────────────────────

class UnavailableDate(BaseModel):
    date: str
    reason: Optional[str] = ""

@router.post("/unavailable")
def mark_unavailable(data: UnavailableDate, user: dict = Depends(require_role("doctor"))):
    # Check if there are already booked appointments on this date
    booked = appointments_col.count_documents({
        "doctor_id": user["id"],
        "date": data.date,
        "status": "booked"
    })
    if booked > 0:
        raise HTTPException(400, f"Cannot mark unavailable — {booked} appointment(s) already booked on this date. Please cancel or reschedule them first.")

    unavailable_col.update_one(
        {"doctor_id": user["id"], "date": data.date},
        {"$set": {"doctor_id": user["id"], "date": data.date, "reason": data.reason or ""}},
        upsert=True
    )
    return {"message": "Date marked as unavailable"}

@router.delete("/unavailable/{date}")
def remove_unavailable(date: str, user: dict = Depends(require_role("doctor"))):
    result = unavailable_col.delete_one({"doctor_id": user["id"], "date": date})
    if result.deleted_count == 0:
        raise HTTPException(404, "Date not found in unavailable list")
    return {"message": "Date marked as available again"}

@router.get("/unavailable/{doctor_id}")
def get_unavailable(doctor_id: str, _: dict = Depends(get_current_user)):
    dates = list(unavailable_col.find({"doctor_id": doctor_id}, {"_id": 0}))
    return dates