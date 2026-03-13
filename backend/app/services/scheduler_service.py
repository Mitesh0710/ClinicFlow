from app.database import appointments_col
from datetime import datetime, timedelta

def parse_slot(date_str: str, time_str: str) -> datetime:
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")

def check_slot_available(doctor_id: str, date: str, time: str, duration_minutes: int = 30, exclude_id: str = None) -> bool:
    new_start = parse_slot(date, time)
    new_end = new_start + timedelta(minutes=duration_minutes)

    existing = appointments_col.find({
        "doctor_id": doctor_id,
        "date": date,
        "status": {"$in": ["booked"]},
    })

    for appt in existing:
        if exclude_id and str(appt["_id"]) == exclude_id:
            continue
        existing_start = parse_slot(appt["date"], appt["time"])
        existing_end = existing_start + timedelta(minutes=appt.get("duration_minutes", 30))
        if new_start < existing_end and new_end > existing_start:
            return False

    return True

def get_available_slots(doctor_id: str, date: str, duration_minutes: int = 30) -> list:
    slots = []
    current = datetime.strptime(f"{date} 09:00", "%Y-%m-%d %H:%M")
    end = datetime.strptime(f"{date} 17:00", "%Y-%m-%d %H:%M")

    while current + timedelta(minutes=duration_minutes) <= end:
        time_str = current.strftime("%H:%M")
        available = check_slot_available(doctor_id, date, time_str, duration_minutes)
        slots.append({"time": time_str, "available": available})
        current += timedelta(minutes=duration_minutes)  # ✅ fixed: was hardcoded 30

    return slots