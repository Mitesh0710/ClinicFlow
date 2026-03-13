from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from app.database import appointments_col, users_col
from app.models.appointment_model import AppointmentCreate, AppointmentReschedule, AppointmentUpdate
from app.services.scheduler_service import check_slot_available, get_available_slots
from app.utils.auth_utils import get_current_user, require_role
from datetime import datetime

router = APIRouter()

def serialize(appt):
    appt["_id"] = str(appt["_id"])
    return appt

@router.post("/book", status_code=201)
def book_appointment(appt: AppointmentCreate, user: dict = Depends(require_role("receptionist"))):
    if not check_slot_available(appt.doctor_id, appt.date, appt.time, appt.duration_minutes):
        raise HTTPException(409, "This slot is already booked. Please choose another time.")

    doctor = users_col.find_one({"_id": ObjectId(appt.doctor_id), "role": "doctor"})
    if not doctor:
        raise HTTPException(404, "Doctor not found")

    doc = appt.dict()
    doc["status"] = "booked"
    doc["created_by"] = user["email"]
    doc["created_at"] = datetime.utcnow().isoformat()
    doc["reminder_sent"] = False

    result = appointments_col.insert_one(doc)

    # Send booking confirmation email immediately
    if appt.patient_email:
        from app.services.reminder_service import send_booking_confirmation
        try:
            send_booking_confirmation(
                appt.patient_email,
                appt.patient_name,
                appt.date,
                appt.time,
                doctor.get("name", "your doctor")
            )
        except Exception as e:
            print(f"[EMAIL] Confirmation failed: {e}")

    return {"message": "Appointment booked", "id": str(result.inserted_id)}

@router.get("/slots/{doctor_id}/{date}")
def available_slots(doctor_id: str, date: str, duration: int = 30, _: dict = Depends(get_current_user)):
    return get_available_slots(doctor_id, date, duration)

@router.get("/list")
def list_appointments(
    doctor_id: str = None,
    date: str = None,
    status: str = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if doctor_id: query["doctor_id"] = doctor_id
    if date: query["date"] = date
    if status: query["status"] = status
    appts = list(appointments_col.find(query).sort("date", 1))
    return [serialize(a) for a in appts]

@router.get("/{appt_id}")
def get_appointment(appt_id: str, _: dict = Depends(get_current_user)):
    appt = appointments_col.find_one({"_id": ObjectId(appt_id)})
    if not appt:
        raise HTTPException(404, "Appointment not found")
    return serialize(appt)

@router.put("/{appt_id}/reschedule")
def reschedule(appt_id: str, data: AppointmentReschedule, _: dict = Depends(require_role("receptionist"))):
    appt = appointments_col.find_one({"_id": ObjectId(appt_id)})
    if not appt:
        raise HTTPException(404, "Appointment not found")
    if appt["status"] == "cancelled":
        raise HTTPException(400, "Cannot reschedule a cancelled appointment")
    if not check_slot_available(appt["doctor_id"], data.new_date, data.new_time,
                                appt.get("duration_minutes", 30), exclude_id=appt_id):
        raise HTTPException(409, "New slot is already taken")
    appointments_col.update_one(
        {"_id": ObjectId(appt_id)},
        {"$set": {"date": data.new_date, "time": data.new_time, "reminder_sent": False}}
    )
    return {"message": "Appointment rescheduled"}

@router.put("/{appt_id}/status")
def update_status(appt_id: str, data: AppointmentUpdate, _: dict = Depends(get_current_user)):
    appt = appointments_col.find_one({"_id": ObjectId(appt_id)})
    if not appt:
        raise HTTPException(404, "Appointment not found")
    appointments_col.update_one({"_id": ObjectId(appt_id)}, {"$set": {"status": data.status}})
    return {"message": f"Status updated to {data.status}"}

@router.delete("/{appt_id}")
def cancel_appointment(appt_id: str, _: dict = Depends(require_role("receptionist"))):
    appt = appointments_col.find_one({"_id": ObjectId(appt_id)})
    if not appt:
        raise HTTPException(404, "Appointment not found")
    appointments_col.update_one({"_id": ObjectId(appt_id)}, {"$set": {"status": "cancelled"}})
    return {"message": "Appointment cancelled"}