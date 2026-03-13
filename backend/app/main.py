from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from app.routes.auth_routes import router as auth_router
from app.routes.appointment_routes import router as appointment_router
from app.routes.doctor_routes import router as doctor_router

app = FastAPI(title="ClinicFlow AI", version="2.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(appointment_router, prefix="/appointments", tags=["Appointments"])
app.include_router(doctor_router, prefix="/doctor", tags=["Doctor"])

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    from app.services.reminder_service import send_pending_reminders
    # Runs every 5 minutes to catch appointments 1 hour away
    scheduler.add_job(send_pending_reminders, "interval", minutes=5)
    scheduler.start()
    print("ClinicFlow AI started. Reminder scheduler active.")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()

@app.get("/")
def health():
    return {"status": "ok", "app": "ClinicFlow AI v2"}
