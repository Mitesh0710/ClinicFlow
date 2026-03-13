import smtplib
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv
load_dotenv()

SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")

print(f"Sending from: {SMTP_USER}")

msg = MIMEText("Test email from ClinicFlow", "plain")
msg["Subject"] = "Test"
msg["From"] = SMTP_USER
msg["To"] = SMTP_USER  # sends to yourself

try:
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.sendmail(SMTP_USER, SMTP_USER, msg.as_string())
    print("SUCCESS - check your inbox")
except Exception as e:
    print(f"FAILED: {e}")