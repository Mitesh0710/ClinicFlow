import React, { useState, useEffect, useCallback } from "react"
import Navbar from "../components/Navbar"
import AppointmentCard from "../components/AppointmentCard"
import { useApi } from "../services/useApi"
import { useRole } from "../context/AuthContext"

export default function DoctorDashboard() {
  const [schedule, setSchedule] = useState([])
  const [stats, setStats] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(true)
  const { mongoId, name } = useRole()
  const { getApi } = useApi()

  // Availability state
  const [unavailableDates, setUnavailableDates] = useState([])
  const [unavailDate, setUnavailDate] = useState("")
  const [unavailReason, setUnavailReason] = useState("")
  const [availLoading, setAvailLoading] = useState(false)
  const [availError, setAvailError] = useState("")
  const [availSuccess, setAvailSuccess] = useState("")
  const [showAvailability, setShowAvailability] = useState(false)

  const load = useCallback(async () => {
    if (!mongoId) return
    setLoading(true)
    try {
      const api = await getApi()
      const [schedRes, statsRes] = await Promise.all([
        api.get(`/doctor/schedule/${mongoId}?date=${selectedDate}`),
        api.get(`/doctor/stats/${mongoId}`)
      ])
      setSchedule(schedRes.data)
      setStats(statsRes.data)
    } finally {
      setLoading(false)
    }
  }, [mongoId, selectedDate])

  const loadUnavailable = useCallback(async () => {
    if (!mongoId) return
    const api = await getApi()
    api.get(`/doctor/unavailable/${mongoId}`).then(r => setUnavailableDates(r.data))
  }, [mongoId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadUnavailable() }, [loadUnavailable])

  const markUnavailable = async () => {
    if (!unavailDate) return
    setAvailLoading(true)
    setAvailError("")
    setAvailSuccess("")
    try {
      const api = await getApi()
      await api.post("/doctor/unavailable", { date: unavailDate, reason: unavailReason })
      setAvailSuccess(`${unavailDate} marked as unavailable`)
      setUnavailDate("")
      setUnavailReason("")
      loadUnavailable()
    } catch (err) {
      setAvailError(err.response?.data?.detail || "Failed to mark unavailable")
    } finally {
      setAvailLoading(false)
      setTimeout(() => setAvailSuccess(""), 3000)
    }
  }

  const removeUnavailable = async (date) => {
    const api = await getApi()
    try {
      await api.delete(`/doctor/unavailable/${date}`)
      loadUnavailable()
    } catch (err) {
      setAvailError(err.response?.data?.detail || "Failed to remove")
    }
  }

  const hours = Array.from({ length: 9 }, (_, i) => `${(9 + i).toString().padStart(2, "0")}:00`)
  const getApptAtTime = (hour) => schedule.find(a => a.time.startsWith(hour.split(":")[0].padStart(2, "0")))
  const isSelectedDateUnavailable = unavailableDates.some(u => u.date === selectedDate)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Doctor" />
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-2xl text-gray-900">Dr. {name?.split(" ").slice(-1)[0]}'s Schedule</h1>
            <p className="text-gray-500 text-sm mt-0.5">Your appointments and daily overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAvailability(v => !v)}
              className={`text-sm px-4 py-2 rounded-xl border font-medium transition-all flex items-center gap-2
                ${showAvailability ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-200 text-gray-600 hover:border-clinic-300 hover:text-clinic-700"}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              Manage Availability
              {unavailableDates.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unavailableDates.length}
                </span>
              )}
            </button>
            <input type="date" className="input-field w-auto text-sm"
              value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          </div>
        </div>

        {/* Availability Panel */}
        {showAvailability && (
          <div className="card p-6 mb-6 border-orange-100 bg-orange-50/30">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              Mark Unavailable Dates
            </h2>

            {availError && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{availError}</div>}
            {availSuccess && <div className="mb-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">✓ {availSuccess}</div>}

            <div className="flex gap-3 flex-wrap mb-5">
              <input type="date" className="input-field w-auto text-sm"
                min={new Date().toISOString().split("T")[0]}
                value={unavailDate} onChange={e => setUnavailDate(e.target.value)} />
              <input type="text" className="input-field flex-1 min-w-48 text-sm" placeholder="Reason (e.g. On leave, Conference...)"
                value={unavailReason} onChange={e => setUnavailReason(e.target.value)} />
              <button onClick={markUnavailable} disabled={!unavailDate || availLoading}
                className="btn-primary text-sm px-5 disabled:opacity-50 flex items-center gap-2">
                {availLoading ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                )}
                Mark Unavailable
              </button>
            </div>

            {/* List of unavailable dates */}
            {unavailableDates.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">No unavailable dates set — you're fully available!</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium mb-2">BLOCKED DATES</p>
                {unavailableDates.sort((a, b) => a.date.localeCompare(b.date)).map(u => (
                  <div key={u.date} className="flex items-center justify-between bg-white border border-red-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-400 shrink-0"/>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {new Date(u.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                        </p>
                        {u.reason && <p className="text-xs text-gray-400 mt-0.5">{u.reason}</p>}
                      </div>
                    </div>
                    <button onClick={() => removeUnavailable(u.date)}
                      className="text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today", value: stats.today || 0, color: "text-blue-700" },
            { label: "Total booked", value: stats.booked || 0, color: "text-gray-800" },
            { label: "Completed", value: stats.completed || 0, color: "text-green-700" },
            { label: "Cancelled", value: stats.cancelled || 0, color: "text-red-600" },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-3xl font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-2 card p-6">
            <h2 className="font-semibold text-gray-800 mb-5 text-sm flex items-center gap-2">
              Schedule for {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
              {isSelectedDateUnavailable && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Unavailable</span>
              )}
            </h2>

            {isSelectedDateUnavailable && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636"/>
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-700">You are marked unavailable on this date</p>
                  {unavailableDates.find(u => u.date === selectedDate)?.reason && (
                    <p className="text-xs text-red-500 mt-0.5">{unavailableDates.find(u => u.date === selectedDate).reason}</p>
                  )}
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading...</div>
            ) : (
              <div className="space-y-1">
                {hours.map(hour => {
                  const appt = getApptAtTime(hour)
                  return (
                    <div key={hour} className="flex gap-4 items-start py-2">
                      <span className="text-xs text-gray-400 w-12 shrink-0 mt-1 font-mono">{hour}</span>
                      {appt ? (
                        <div className={`flex-1 rounded-xl px-4 py-3 text-sm border-l-4
                          ${appt.status === "completed" ? "bg-green-50 border-green-400" :
                            appt.status === "cancelled" ? "bg-red-50 border-red-300 opacity-60" :
                            "bg-blue-50 border-blue-400"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{appt.patient_name}</span>
                            <span className="text-xs text-gray-500">{appt.time} · {appt.duration_minutes || 30}min</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{appt.patient_phone}</p>
                          {appt.notes && <p className="text-xs text-gray-400 mt-1 italic">"{appt.notes}"</p>}
                        </div>
                      ) : (
                        <div className={`flex-1 border border-dashed rounded-xl px-4 py-3 ${isSelectedDateUnavailable ? "border-red-100 bg-red-50/30" : "border-gray-100"}`}>
                          <span className={`text-xs ${isSelectedDateUnavailable ? "text-red-300" : "text-gray-300"}`}>
                            {isSelectedDateUnavailable ? "Unavailable" : "Available"}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Patient list */}
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800 text-sm">Today's patients</h2>
            {schedule.filter(a => a.status !== "cancelled").length === 0 ? (
              <div className="card p-6 text-center text-gray-400 text-sm">No patients today</div>
            ) : (
              schedule.filter(a => a.status !== "cancelled").map(a => (
                <AppointmentCard key={a._id} appt={a} onRefresh={load} showActions={true} getApi={getApi} />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}