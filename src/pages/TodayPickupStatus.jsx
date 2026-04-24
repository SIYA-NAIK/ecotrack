import React, { useEffect, useMemo, useState } from "react";
import {
  FaTruck,
  FaClock,
  FaCheckCircle,
  FaMapMarkerAlt,
  FaUser,
  FaRoute,
} from "react-icons/fa";
import "./todaypickupstatus.css";

const BACKEND_URL = "https://ecotrack-mqko.onrender.com";

export default function TodayPickupStatus({ userId }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTracking = async (silent = false) => {
    if (!userId) return;

    try {
      if (!silent) setLoading(true);

      const res = await fetch(`${API_BASE}/api/tracking/live?userId=${userId}`);
      const data = await res.json();

      if (res.ok) {
        setTracking(data?.tracking || null);
      } else {
        setTracking(null);
      }
    } catch (err) {
      console.error("Live tracking fetch failed:", err);
      setTracking(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();

    const interval = setInterval(() => {
      fetchTracking(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [userId]);

  const statusInfo = useMemo(() => {
    const rawStatus = String(tracking?.status || tracking?.pickup_status || "")
      .trim()
      .toLowerCase();

    if (rawStatus === "arrived") {
      return {
        label: "Arrived at Location",
        className: "tps-status-arrived",
        message: "The truck has reached your location.",
      };
    }

    if (
      rawStatus === "completed" ||
      rawStatus === "collected"
    ) {
      return {
        label: "Pickup Completed",
        className: "tps-status-completed",
        message: "Today's pickup has been completed successfully.",
      };
    }

    if (rawStatus === "missed") {
      return {
        label: "Pickup Missed",
        className: "tps-status-missed",
        message: "Today's pickup was marked as missed.",
      };
    }

    if (
      rawStatus === "assigned" ||
      rawStatus === "scheduled"
    ) {
      return {
        label: "Truck Assigned",
        className: "tps-status-assigned",
        message: "Your pickup is scheduled and truck assignment is ready.",
      };
    }

    if (
      rawStatus === "ongoing" ||
      rawStatus === "in_progress" ||
      rawStatus === "in progress" ||
      rawStatus === "active"
    ) {
      const eta = Number(tracking?.eta_minutes);

      if (Number.isFinite(eta) && eta <= 5) {
        return {
          label: "Nearby",
          className: "tps-status-nearby",
          message: "The truck is very close to your location.",
        };
      }

      return {
        label: "On the Way",
        className: "tps-status-ontheway",
        message: "The truck is on the way to your location.",
      };
    }

    return {
      label: "Awaiting Update",
      className: "tps-status-awaiting",
      message: "Tracking will appear once today's pickup becomes active.",
    };
  }, [tracking]);

  if (!userId) return null;

  return (
    <div className="tps-wrap">
      <div className="tps-card">
        <div className="tps-head">
          <div>
            <h3>Today’s Pickup Status</h3>
            <p>Synced with live truck tracking and pickup schedule.</p>
          </div>
          <span className="tps-live-badge">Live Sync</span>
        </div>

        {loading ? (
          <div className="tps-loading">Loading today’s pickup status...</div>
        ) : !tracking ? (
          <div className="tps-empty">
            No active pickup found for today.
          </div>
        ) : (
          <>
            <div className={`tps-status-banner ${statusInfo.className}`}>
              <strong>{statusInfo.label}</strong>
              <span>{statusInfo.message}</span>
            </div>

            <div className="tps-grid">
              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaTruck />
                </div>
                <div>
                  <div className="tps-label">Truck Number</div>
                  <div className="tps-value">
                    {tracking.route_vehicle || "--"}
                  </div>
                </div>
              </div>

              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaUser />
                </div>
                <div>
                  <div className="tps-label">Driver</div>
                  <div className="tps-value">
                    {tracking.driver_name || "Not assigned"}
                  </div>
                </div>
              </div>

              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaClock />
                </div>
                <div>
                  <div className="tps-label">ETA</div>
                  <div className="tps-value">
                    {tracking.eta_minutes === null ||
                    tracking.eta_minutes === undefined
                      ? "--"
                      : `${tracking.eta_minutes} min`}
                  </div>
                </div>
              </div>

              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaMapMarkerAlt />
                </div>
                <div>
                  <div className="tps-label">Area</div>
                  <div className="tps-value">
                    {tracking.area || "Resident Area"}
                  </div>
                </div>
              </div>

              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaRoute />
                </div>
                <div>
                  <div className="tps-label">Tracking Mode</div>
                  <div className="tps-value">
                    {tracking.tracking_mode || "--"}
                  </div>
                </div>
              </div>

              <div className="tps-item">
                <div className="tps-item-icon">
                  <FaCheckCircle />
                </div>
                <div>
                  <div className="tps-label">Pickup Status</div>
                  <div className="tps-value">
                    {tracking.pickup_status || tracking.status || "--"}
                  </div>
                </div>
              </div>
            </div>

            <div className="tps-progress-wrap">
              <div className="tps-progress-top">
                <span>Progress</span>
                <span>{Number(tracking.progress || 0)}%</span>
              </div>

              <div className="tps-progress-bar">
                <div
                  className="tps-progress-fill"
                  style={{ width: `${Number(tracking.progress || 0)}%` }}
                />
              </div>
            </div>

            <div className="tps-meta">
              <div>
                <span className="tps-meta-label">Pickup Date:</span>{" "}
                {tracking.pickup_date || "--"}
              </div>
              <div>
                <span className="tps-meta-label">Preferred Time:</span>{" "}
                {tracking.preferred_time || "--"}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}