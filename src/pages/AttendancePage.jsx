import React from "react";
import ResidentNavbar from "../components/ResidentNavbar";
import AttendanceCalendar from "../components/AttendanceCalendar";

export default function AttendancePage() {
  const stored = localStorage.getItem("user");
  const userId = stored ? JSON.parse(stored)?.id : null;

  return (
    <>
      <ResidentNavbar />

      {/* ===== HERO SECTION (LIKE SCHEDULE PICKUP) ===== */}
      <section className="attendance-hero">
        <div className="attendance-pill">
          <span className="pill-dot"></span>
          Waste Management System
        </div>

        <h1>Attendance Calendar</h1>
        <p>
          Track your monthly waste collection performance and monitor pickup
          completion rates.
        </p>
      </section>

      <AttendanceCalendar userId={userId} />
    </>
  );
}