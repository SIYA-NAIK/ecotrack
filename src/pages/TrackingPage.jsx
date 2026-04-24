import React from "react";
import ResidentNavbar from "../components/ResidentNavbar.jsx";
import LiveTrackingMap from "../components/LiveTrackingMap.jsx";
import "../styles/dashboard.css";

export default function TrackingPage() {
  return (
    <div className="tracking-page-shell">
      <ResidentNavbar activeTab="Tracking" />
      <main className="tracking-page-main">
        <LiveTrackingMap />
      </main>
    </div>
  );
}
