import React, { useEffect, useMemo, useState } from "react";
import RightPanel from "./RightPanel";
import "../styles/calender.css";

const API = "https://ecotrack-mqko.onrender.com/api";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function AttendanceCalendar({ userId }) {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const [status, setStatus] = useState({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [animatedDays, setAnimatedDays] = useState({});

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();

  const dateKey = (y, mIndex, d) => {
    const mm = String(mIndex + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  };

  const isTodayDate = (y, mIndex, d) => {
    return (
      y === today.getFullYear() &&
      mIndex === today.getMonth() &&
      d === today.getDate()
    );
  };

  const isFutureDate = (y, mIndex, d) => {
    return (
      y > today.getFullYear() ||
      (y === today.getFullYear() && mIndex > today.getMonth()) ||
      (y === today.getFullYear() &&
        mIndex === today.getMonth() &&
        d > today.getDate())
    );
  };

  const isPastDate = (y, mIndex, d) => {
    return (
      y < today.getFullYear() ||
      (y === today.getFullYear() && mIndex < today.getMonth()) ||
      (y === today.getFullYear() &&
        mIndex === today.getMonth() &&
        d < today.getDate())
    );
  };

  // FINAL RULE:
  // future -> blank
  // missed/no -> red
  // everything else (past + today + default) -> green
  const getDisplayStatus = (key, day) => {
    if (isFutureDate(year, monthIndex, day)) return "";
    if (status[key] === "no") return "no";
    return "yes";
  };

  const prevMonth = () => {
    if (monthIndex === 0) {
      setMonthIndex(11);
      setYear((prev) => prev - 1);
    } else {
      setMonthIndex((prev) => prev - 1);
    }
  };

  const nextMonth = () => {
    if (monthIndex === 11) {
      setMonthIndex(0);
      setYear((prev) => prev + 1);
    } else {
      setMonthIndex((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const fetchMonth = async () => {
      if (!userId) {
        setStatus({});
        return;
      }

      try {
        setLoadingMonth(true);
        setMsg("");

        await fetch(`${API_BASE}/api/attendance/ensure-today`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        const month = monthIndex + 1;
        const res = await fetch(
          `${API_BASE}/api/attendance?userId=${userId}&year=${year}&month=${month}`
        );

        const data = await res.json();

        if (!res.ok) {
          setStatus({});
          setMsg(data.message || "Failed to load attendance");
          return;
        }

        const map = {};
        (data.attendance || []).forEach((row) => {
          const key = row.date || row.attendance_date;
          map[key] = row.status;
        });

        setStatus(map);
      } catch (error) {
        console.error("Attendance fetch error:", error);
        setStatus({});
        setMsg("Server error while loading attendance");
      } finally {
        setLoadingMonth(false);
      }
    };

    fetchMonth();
  }, [userId, year, monthIndex]);

  useEffect(() => {
    const animMap = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(year, monthIndex, day);
      const isToday = isTodayDate(year, monthIndex, day);
      const displayStatus = getDisplayStatus(key, day);

      if (isToday && displayStatus === "yes" && status[key] == null) {
        animMap[key] = true;
      }
    }

    setAnimatedDays(animMap);
  }, [status, year, monthIndex, daysInMonth]);

  const saveAttendance = async (day, value) => {
    if (!userId) {
      setMsg("UserId missing. Please login again.");
      return;
    }

    if (!isTodayDate(year, monthIndex, day)) {
      setMsg("Only today's attendance can be changed.");
      setSelectedDay(null);
      return;
    }

    const key = dateKey(year, monthIndex, day);

    try {
      setSaving(true);
      setMsg("");

      const res = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: key,
          status: value,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data.message || "Failed to save attendance");
        return;
      }

      setStatus((prev) => ({
        ...prev,
        [key]: value,
      }));

      setSelectedDay(null);
      setMsg(
        value === "no"
          ? "Pickup marked as missed."
          : data.message || "Attendance updated successfully"
      );
    } catch (error) {
      console.error("Attendance save error:", error);
      setMsg("Server error while saving");
    } finally {
      setSaving(false);
    }
  };

  const undoMissed = async (day) => {
    if (!userId) {
      setMsg("UserId missing. Please login again.");
      return;
    }

    if (!isTodayDate(year, monthIndex, day)) {
      setMsg("Only today's attendance can be changed.");
      setSelectedDay(null);
      return;
    }

    const key = dateKey(year, monthIndex, day);

    try {
      setSaving(true);
      setMsg("");

      const res = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          date: key,
          status: "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(
          data.message ||
            "Undo failed. Allow empty status in backend to reset today's missed mark."
        );
        return;
      }

      setStatus((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });

      setSelectedDay(null);
      setMsg("Missed mark removed. Day is green again.");
    } catch (error) {
      console.error("Undo attendance error:", error);
      setMsg("Server error while undoing missed status");
    } finally {
      setSaving(false);
    }
  };

  const todayKey = useMemo(() => {
    return dateKey(year, monthIndex, today.getDate());
  }, [year, monthIndex, today]);

  const todayStatus = status[todayKey];

  let completed = 0;
  let missed = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const key = dateKey(year, monthIndex, day);
    const displayStatus = getDisplayStatus(key, day);

    if (displayStatus === "yes") completed++;
    if (displayStatus === "no") missed++;
  }

  const total = completed + missed;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="dashboard-container">
      <div className="calendar-section">
        {loadingMonth && <p style={{ marginTop: 6 }}>Loading month...</p>}
        {msg && <p style={{ marginTop: 6 }}>{msg}</p>}

        

        <div className="calendar-card">
          <div className="calendar-top">
            <button onClick={prevMonth}>◀</button>
            <h3>
              {months[monthIndex]} {year}
            </h3>
            <button onClick={nextMonth}>▶</button>
          </div>

          <div className="weekdays">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`}></div>
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = dateKey(year, monthIndex, day);

              const isFuture = isFutureDate(year, monthIndex, day);
              const isPast = isPastDate(year, monthIndex, day);
              const isToday = isTodayDate(year, monthIndex, day);

              const displayStatus = getDisplayStatus(key, day);
              const shouldAnimate = Boolean(animatedDays[key]);

              return (
                <div
                  key={day}
                  title={
                    isFuture
                      ? "Future date"
                      : isPast
                      ? "Past dates are locked"
                      : "Only today can be updated"
                  }
                  className={`day
                    ${displayStatus === "yes" ? "green" : ""}
                    ${displayStatus === "no" ? "red" : ""}
                    ${isFuture ? "future" : ""}
                    ${isToday ? "today" : ""}
                    ${isPast ? "locked" : ""}
                    ${shouldAnimate ? "auto-mark-pulse" : ""}
                  `}
                  onClick={() => {
                    if (!isToday) return;
                    setSelectedDay(day);
                  }}
                >
                  <>
                    {day}
                    {isToday && <span className="today-dot"></span>}
                  </>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="right-panel">
        <RightPanel completed={completed} missed={missed} rate={rate} />
      </div>

      {selectedDay && (
        <div className="overlay">
          <div className="modal">
            <h3>
              {months[monthIndex]} {selectedDay}, {year}
            </h3>
            <p>Mark as missed only. Otherwise the day remains collected.</p>

            <div className="popup-buttons">
              <button
                onClick={() => saveAttendance(selectedDay, "no")}
                disabled={saving}
                className="danger-btn"
              >
                {saving ? "Saving..." : "Mark as Missed"}
              </button>

              {status[dateKey(year, monthIndex, selectedDay)] === "no" && (
                <button
                  onClick={() => undoMissed(selectedDay)}
                  disabled={saving}
                  className="secondary-btn"
                >
                  {saving ? "Saving..." : "Undo Missed"}
                </button>
              )}
            </div>

            <button onClick={() => setSelectedDay(null)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .danger-btn {
          background: #e74c3c;
          color: #fff;
          border: none;
        }

        .secondary-btn {
          background: #f3f4f6;
          color: #111827;
          border: 1px solid #d1d5db;
        }

        .auto-mark-pulse {
          animation: autoMarkPulse 1.4s ease-in-out infinite;
        }

        @keyframes autoMarkPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.35);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.08);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
      `}</style>
    </div>
  );
}