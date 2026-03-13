from app.database import appointments_col
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

print(f"[EMAIL] SMTP configured for: {SMTP_USER}")

def send_email(to_email: str, subject: str, html: str):
    if not SMTP_USER:
        print(f"[EMAIL] No SMTP configured. Would send to {to_email}: {subject}")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        print(f"[EMAIL] Sent to {to_email}: {subject}")
    except Exception as e:
        print(f"[EMAIL] Failed to send to {to_email}: {e}")

def send_booking_confirmation(to_email: str, patient_name: str, date: str, time: str, doctor_name: str):
    subject = f"Appointment Confirmed — {date} at {time}"
    html = f"""
    <html><body style="font-family:sans-serif;background:#f9fafb;padding:32px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
      <h2 style="color:#0f172a;margin:0 0 8px">✅ Appointment Confirmed</h2>
      <p style="color:#6b7280;margin:0 0 24px">Hello <strong>{patient_name}</strong>, your appointment has been booked successfully.</p>
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px;border-radius:8px;margin-bottom:24px">
        <p style="margin:0;font-size:15px;color:#166534">
          <strong>Date:</strong> {date}<br>
          <strong>Time:</strong> {time}<br>
          <strong>Doctor:</strong> {doctor_name}
        </p>
      </div>
      <p style="color:#6b7280;font-size:13px">Please arrive 10 minutes early. To reschedule, contact the clinic.</p>
    </div>
    </body></html>
    """
    send_email(to_email, subject, html)

def send_reminder_email(to_email: str, patient_name: str, date: str, time: str, doctor_name: str):
    subject = f"⏰ Appointment in 1 hour — {time} today"
    html = f"""
    <html><body style="font-family:sans-serif;background:#f9fafb;padding:32px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
      <h2 style="color:#0f172a;margin:0 0 8px">⏰ Your appointment is in 1 hour</h2>
      <p style="color:#6b7280;margin:0 0 24px">Hello <strong>{patient_name}</strong>, this is a reminder for your upcoming appointment.</p>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin-bottom:24px">
        <p style="margin:0;font-size:15px;color:#92400e">
          <strong>Date:</strong> {date}<br>
          <strong>Time:</strong> {time}<br>
          <strong>Doctor:</strong> {doctor_name}
        </p>
      </div>
      <p style="color:#6b7280;font-size:13px">Please arrive 10 minutes early. To reschedule, contact the clinic.</p>
    </div>
    </body></html>
    """
    send_email(to_email, subject, html)

def send_pending_reminders():
    from app.database import users_col
    from bson import ObjectId

    now = datetime.utcnow()
    window_start = now + timedelta(minutes=55)
    window_end = now + timedelta(minutes=65)
    today = now.strftime("%Y-%m-%d")

    pending = appointments_col.find({
        "date": today,
        "status": "booked",
        "reminder_sent": False,
        "patient_email": {"$exists": True, "$ne": ""}
    })

    count = 0
    for appt in pending:
        try:
            appt_time = datetime.strptime(f"{appt['date']} {appt['time']}", "%Y-%m-%d %H:%M")
        except Exception:
            continue

        if not (window_start <= appt_time <= window_end):
            continue

        doctor = users_col.find_one({"_id": ObjectId(appt["doctor_id"])})
        doctor_name = doctor["name"] if doctor else "your doctor"

        send_reminder_email(
            appt["patient_email"],
            appt["patient_name"],
            appt["date"],
            appt["time"],
            doctor_name
        )
        appointments_col.update_one({"_id": appt["_id"]}, {"$set": {"reminder_sent": True}})
        count += 1

    print(f"[REMINDER] Sent {count} reminders for appointments around {window_start.strftime('%H:%M')}")
    return count