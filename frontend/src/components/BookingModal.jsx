import React, { useState, useEffect } from "react"
import { useApi } from "../services/useApi.js"

export default function BookingModal({ onClose, onSuccess, rescheduleAppt = null }) {
  const [doctors, setDoctors] = useState([])
  const [slots, setSlots] = useState([])
  const [form, setForm] = useState({
    patient_name: "", patient_phone: "", patient_email: "",
    doctor_id: "", date: "", time: "", duration_minutes: 30, notes: ""
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isReschedule = !!rescheduleAppt
  const { getApi } = useApi()

  useEffect(() => {
    const init = async () => {
      const api = await getApi()
      api.get("/doctor/list").then(r => setDoctors(r.data))
      if (rescheduleAppt) {
        setForm(f => ({ ...f, doctor_id: rescheduleAppt.doctor_id, duration_minutes: rescheduleAppt.duration_minutes || 30 }))
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (form.doctor_id && form.date) {
      const fetchSlots = async () => {
        const api = await getApi()
        api.get(`/appointments/slots/${form.doctor_id}/${form.date}?duration=${form.duration_minutes}`)
          .then(r => {
            const today = new Date().toISOString().split("T")[0]
            const isToday = form.date === today

            const filtered = r.data.map(s => {
              if (!isToday) return s
              // Compare slot time with current time
              const [slotHour, slotMin] = s.time.split(":").map(Number)
              const now = new Date()
              const slotDate = new Date()
              slotDate.setHours(slotHour, slotMin, 0, 0)
              // Mark past slots as unavailable
              if (slotDate <= now) return { ...s, available: false }
              return s
            })

            setSlots(filtered)
          })
          .catch(() => setSlots([]))
      }
      fetchSlots()
    }
  }, [form.doctor_id, form.date, form.duration_minutes])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const api = await getApi()
      if (isReschedule) {
        await api.put(`/appointments/${rescheduleAppt._id}/reschedule`, {
          new_date: form.date,
          new_time: form.time
        })
      } else {
        await api.post("/appointments/book", form)
      }
      onSuccess?.()
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{isReschedule ? "Reschedule Appointment" : "New Appointment"}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

          {!isReschedule && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Patient name *</label>
                  <input required className="input-field" placeholder="Full name"
                    value={form.patient_name} onChange={e => set("patient_name", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                  <input required className="input-field" placeholder="9876543210"
                    value={form.patient_phone} onChange={e => set("patient_phone", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email (for reminders)</label>
                <input type="email" className="input-field" placeholder="patient@email.com"
                  value={form.patient_email} onChange={e => set("patient_email", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Doctor *</label>
                <select required className="input-field" value={form.doctor_id} onChange={e => set("doctor_id", e.target.value)}>
                  <option value="">Select doctor</option>
                  {doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input required type="date" className="input-field"
                min={new Date().toISOString().split("T")[0]}
                value={form.date} onChange={e => { set("date", e.target.value); set("time", "") }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
              <select className="input-field" value={form.duration_minutes}
                onChange={e => set("duration_minutes", +e.target.value)}>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>

          {slots.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Available slots *</label>
              <div className="grid grid-cols-4 gap-2">
                {slots.map(s => (
                  <button type="button" key={s.time} disabled={!s.available}
                    onClick={() => s.available && set("time", s.time)}
                    className={`text-xs py-2 rounded-lg border transition-all font-medium
                      ${!s.available
                        ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                        : form.time === s.time
                          ? "bg-clinic-600 text-white border-clinic-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-clinic-400 hover:text-clinic-700"
                      }`}>
                    {s.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isReschedule && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input-field resize-none" rows={2}
                placeholder="Reason for visit, symptoms, etc."
                value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={loading || !form.time}
              className="flex-1 btn-primary text-sm disabled:opacity-50">
              {loading ? "Saving..." : isReschedule ? "Reschedule" : "Book Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}