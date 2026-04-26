import React, { useCallback, useEffect, useMemo, useState } from "react";
import LiveTrackingMap from "../components/LiveTrackingMap.jsx";
import TrackingMiniMap from "../components/TrackingMiniMap.jsx";
import ResidentNavbar from "../components/ResidentNavbar.jsx";
import { useNavigate } from "react-router-dom";
import {
  FaTrash,
  FaTruck,
  FaRecycle,
  FaFileAlt,
  FaExclamationCircle,
  FaInbox,
} from "react-icons/fa";
import "../styles/dashboard.css";
import "../styles/styles.css";

const API_BASE = "https://ecotrack-mqko.onrender.com";
const API = `${API_BASE}/api`;

const Dashboard = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState({});
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [nextPickup, setNextPickup] = useState(null);
  const [nextPickupLoading, setNextPickupLoading] = useState(false);

  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* ================= THEME INIT ================= */
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
      return;
    }

    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initial = prefersDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  /* ================= LOAD USER ================= */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const role = localStorage.getItem("role") || "resident";

    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const name =
        parsedUser.full_name || parsedUser.name || parsedUser.email || "User";

      setUser({
        id: parsedUser.id,
        name,
        email: parsedUser.email || "No email",
        role,
      });
    } else {
      setUser({ id: null, name: "User", email: "No email", role });
    }
  }, []);

  /* ================= HELPERS ================= */
  const safeDateOnly = useCallback((dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === "string" && dateStr.includes("T")) {
      return dateStr.split("T")[0];
    }
    return dateStr;
  }, []);

  const isPickupToday = useCallback(
    (dateStr) => {
      const only = safeDateOnly(dateStr);
      if (!only) return false;

      const d = new Date(only + "T00:00:00");
      const now = new Date();

      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    },
    [safeDateOnly]
  );

  const formatPickupDay = (dateStr) => {
    const only = safeDateOnly(dateStr);
    if (!only) return "—";

    const d = new Date(only + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return "Today";
    if (sameDay(d, tomorrow)) return "Tomorrow";

    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  const formatFullDate = (dateStr) => {
    const only = safeDateOnly(dateStr);
    if (!only) return "—";
    const d = new Date(only + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatPickupTime = (timeStr) => {
    if (!timeStr) return "—";

    const value = String(timeStr).trim();

    if (
      value.toUpperCase().includes("AM") ||
      value.toUpperCase().includes("PM")
    ) {
      return value;
    }

    const [hh, mm] = value.split(":");
    if (hh == null || mm == null) return value;

    const date = new Date();
    date.setHours(Number(hh), Number(mm), 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatLastUpdate = (lastUpdateStr) => {
    if (!lastUpdateStr) return "—";
    const isoLike = String(lastUpdateStr).replace(" ", "T");
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return lastUpdateStr;
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateStr) => {
    const only = safeDateOnly(dateStr);
    if (!only) return "—";

    const d = new Date(only + "T00:00:00");
    if (isNaN(d.getTime())) return only;

    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (value === "completed" || value === "collected") return "ok";
    if (
      value === "missed" ||
      value === "failed" ||
      value === "cancelled"
    ) {
      return "danger";
    }

    return "pending";
  };

  const getHistoryTypeLabel = (item) => {
    if (item?.type) return item.type;
    if (item?.history_kind === "daily") return "Daily Pickup";
    if (item?.history_kind === "scheduled") return "Scheduled Pickup";
    return "—";
  };

  const getHistoryDate = (item) => {
    return item?.date || item?.due_date || item?.pickup_date || null;
  };

  /* ================= DEDUPE HISTORY ================= */
  const removeDuplicateHistory = useCallback(
    (items) => {
      if (!Array.isArray(items)) return [];

      const seen = new Set();
      const cleaned = [];

      for (const item of items) {
        const date = safeDateOnly(
          item?.date || item?.due_date || item?.pickup_date || ""
        );
        const kind = String(item?.history_kind || "").toLowerCase().trim();
        const category =
          kind === "daily"
            ? "daily"
            : kind === "scheduled"
            ? "scheduled"
            : "pickup";
        const type = String(item?.type || "").toLowerCase().trim();
        const status = String(item?.status || "").toLowerCase().trim();

        const uniqueKey = `${date}|${category}|${type}|${status}`;

        if (!seen.has(uniqueKey)) {
          seen.add(uniqueKey);
          cleaned.push(item);
        }
      }

      return cleaned;
    },
    [safeDateOnly]
  );

  /* ================= DAILY PICKUP LABEL FIX ================= */
  const getPickupTypeLabel = (pickup) => {
    if (!pickup) return "—";

    const rawType = String(pickup.type || "").trim().toLowerCase();
    const rawTitle = String(pickup.title || "").trim().toLowerCase();

    if (
      rawType === "mixed waste" ||
      rawTitle.startsWith("garbage pickup")
    ) {
      return "Regular Waste Collection";
    }

    return pickup.type || "—";
  };

  /* ================= FETCH NEXT PICKUP ================= */
  useEffect(() => {
    const fetchNextPickup = async () => {
      if (!user?.id) return;

      try {
        setNextPickupLoading(true);

        const res = await fetch(
          `${API_BASE}/api/pickups/next?userId=${user.id}`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error("Next pickup error:", data);
          setNextPickup(null);
          return;
        }

        setNextPickup(data?.nextPickup || null);
      } catch (err) {
        console.error("Next pickup fetch failed:", err);
        setNextPickup(null);
      } finally {
        setNextPickupLoading(false);
      }
    };

    fetchNextPickup();
  }, [user?.id]);

  /* ================= RECENT HISTORY ================= */
  useEffect(() => {
    if (!user?.id) return;

    const fetchRecentHistory = async () => {
      try {
        setHistoryLoading(true);

        const res = await fetch(
          `${API_BASE}/api/history/recent?userId=${user.id}&limit=20`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error("History error:", data);
          setHistory([]);
          return;
        }

        const rawHistory = Array.isArray(data?.history) ? data.history : [];
        const uniqueHistory = removeDuplicateHistory(rawHistory).slice(0, 5);

        setHistory(uniqueHistory);
      } catch (err) {
        console.error("History fetch failed:", err);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchRecentHistory();
  }, [removeDuplicateHistory, user?.id]);

  /* ================= GREETING ================= */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const firstName = user.name ? user.name.split(" ")[0] : "User";

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return new Date().toDateString();
    }
  }, []);

  /* ================= QUICK ACTIONS ================= */
  const onSchedulePickup = () => navigate("/schedule-pickup");
  const onReportIssue = () => navigate("/report-issue");
  const onViewReports = () => navigate("/my-reports");
  const onViewRoute = () => navigate("/tracking");
  const onSeeAllHistory = () => navigate("/history");

  /* ================= NEXT PICKUP UI VALUES ================= */
  const pickupLabel = nextPickup ? formatPickupDay(nextPickup.due_date) : "—";
  const pickupFullDate = nextPickup ? formatFullDate(nextPickup.due_date) : "—";
  const pickupTime = nextPickup ? formatPickupTime(nextPickup.start_time) : "—";
  const pickupType = getPickupTypeLabel(nextPickup);

  const pickupStatus = nextPickupLoading
    ? "Loading"
    : nextPickup?.status
    ? nextPickup.status
    : "No Pickup";

  /* ================= TRACKING WINDOW: START AT PICKUP TIME, LAST 2 HOURS ================= */
  const trackingWindow = useMemo(() => {
    if (!nextPickup) {
      return {
        shouldShowTracking: false,
        hasEnded: false,
        pickupStart: null,
        pickupEnd: null,
      };
    }

    if (!isPickupToday(nextPickup.due_date) || !nextPickup.start_time) {
      return {
        shouldShowTracking: false,
        hasEnded: false,
        pickupStart: null,
        pickupEnd: null,
      };
    }

    const [hh, mm] = String(nextPickup.start_time).split(":");

    const pickupStart = new Date();
    pickupStart.setHours(Number(hh), Number(mm), 0, 0);

    const pickupEnd = new Date(pickupStart);
    pickupEnd.setHours(pickupEnd.getHours() + 2);

    const now = new Date();

    return {
      shouldShowTracking: now >= pickupStart && now <= pickupEnd,
      hasEnded: now > pickupEnd,
      pickupStart,
      pickupEnd,
    };
  }, [isPickupToday, nextPickup]);

  const shouldShowTracking = trackingWindow.shouldShowTracking;
  const hasTrackingEnded = trackingWindow.hasEnded;

  /* ================= FETCH LIVE TRACKING ================= */
  useEffect(() => {
    if (!user?.id || !shouldShowTracking) {
      setTracking(null);
      setTrackingLoading(false);
      return;
    }

    const fetchTracking = async () => {
      try {
        setTrackingLoading(true);

        const res = await fetch(
          `${API_BASE}/api/tracking/live?userId=${user.id}`
        );
        const data = await res.json();

        if (!res.ok) {
          console.error("Tracking error:", data);
          setTracking(null);
          return;
        }

        setTracking(data?.tracking || null);
      } catch (err) {
        console.error("Tracking fetch failed:", err);
        setTracking(null);
      } finally {
        setTrackingLoading(false);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);

    return () => clearInterval(interval);
  }, [user?.id, shouldShowTracking]);

  /* ================= TRACKING UI VALUES ================= */
  const trackingStatus = trackingLoading
    ? "Loading"
    : shouldShowTracking
    ? tracking?.status || "Active"
    : hasTrackingEnded
    ? "Completed"
    : "Not started";

  const trackingEta =
    shouldShowTracking && tracking?.eta_minutes != null
      ? `${tracking.eta_minutes} min`
      : "—";

  const trackingProgress =
    shouldShowTracking && tracking?.progress != null
      ? Number(tracking.progress)
      : hasTrackingEnded
      ? 100
      : 0;

  const trackingDriver =
    shouldShowTracking && tracking?.route_vehicle
      ? tracking.route_vehicle
      : hasTrackingEnded
      ? "Route completed"
      : "Preview only";

  const trackingLastUpdate =
    shouldShowTracking && tracking?.last_update
      ? formatLastUpdate(tracking.last_update)
      : hasTrackingEnded
      ? "Pickup window ended"
      : "Not started";

  /* ================= ENSURE TAB VALID ================= */
  useEffect(() => {
    const allowed = ["Dashboard", "Tracking"];
    if (!allowed.includes(activeTab)) setActiveTab("Dashboard");
  }, [activeTab]);

  return (
    <div className="dash-layout">
      <ResidentNavbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "Report Issue") return navigate("/report-issue");
          if (tab === "Schedule Pickup") return navigate("/schedule-pickup");
          if (tab === "Attendance") return navigate("/attendance");
          if (tab === "Tracking") return navigate("/tracking");
          if (tab === "History") return navigate("/history");
          setActiveTab("Dashboard");
        }}
      />

      <div className="dash-content">
        {activeTab === "Dashboard" && (
          <div className="page-header card">
            <div className="page-header-top">
              <div>
                <div className="breadcrumb">Home / Resident / {activeTab}</div>
                <h1 className="page-title">
                  {getGreeting()}, {firstName} 👋
                </h1>
                <p className="page-subtitle">
                  Here’s your waste management overview
                </p>
              </div>

              <div className="page-header-right">
                <div className="date-pill">📅 {todayLabel}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Dashboard" && (
          <>
            <div className="top-grid">
              <div className="card pickup-card fade-in">
                <div className="card-top">
                  <div className="card-title">
                    <span className="card-title-icon">
                      <FaTrash />
                    </span>
                    <span>Next Pickup</span>
                  </div>
                  <span className="badge badge-green">{pickupStatus}</span>
                </div>

                <div className="card-divider" />

                <div className="stat-big">{pickupLabel}</div>

                <div className="chip-row">
                  <span className="chip">📅 {pickupFullDate}</span>
                  <span className="chip">🕒 {pickupTime}</span>
                  <span className="chip chip-green">🗑️ {pickupType}</span>
                </div>

                <div className="hint">
                  {nextPickupLoading
                    ? "Loading next pickup..."
                    : nextPickup
                    ? "Tip: Keep bins outside by 6:45 AM."
                    : "No pickup scheduled."}
                </div>
              </div>

              <div
                className="card tracking-card fade-in clickable-card"
                onClick={() => navigate("/tracking")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate("/tracking");
                  }
                }}
                title="Open tracker page"
              >
                <div className="card-top">
                  <div className="card-title">
                    <span className="card-title-icon">
                      <FaTruck />
                    </span>
                    <span>Live Tracking</span>
                  </div>
                  <span className="badge">{trackingStatus}</span>
                </div>

                <div className="card-divider" />

                <div className="tracking-grid">
                  <div>
                    <div className="tracking-eta-label">Estimated arrival</div>
                    <div className="tracking-eta-value">
                      {shouldShowTracking ? trackingEta : "—"}
                    </div>

                    <div className="chip-row">
                      <span className="chip">🚚 {trackingDriver}</span>
                      <span className="chip">⏱ {trackingLastUpdate}</span>
                    </div>

                    {!shouldShowTracking && !hasTrackingEnded && (
                      <div className="hint" style={{ marginTop: 10 }}>
                        📍 Map preview is shown below. Full live tracking starts
                        at pickup time and stays active for 2 hours.
                      </div>
                    )}

                    {hasTrackingEnded && (
                      <div className="hint" style={{ marginTop: 10 }}>
                        ✅ Live tracking window has ended for today’s pickup.
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="progress-wrap">
                      <div className="progress-meta">
                        <span>Progress</span>
                        <span>
                          {shouldShowTracking || hasTrackingEnded
                            ? `${trackingProgress}%`
                            : "0%"}
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${
                              shouldShowTracking || hasTrackingEnded
                                ? trackingProgress
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      className="action-btn primary compact"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewRoute();
                      }}
                    >
                      Open Tracker
                    </button>
                  </div>
                </div>

                <div
                  className="dashboard-mini-map"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TrackingMiniMap />
                </div>
              </div>
            </div>

            <div className="bottom-grid dash-section">
              <div className="bottom-main">
                <div className="card history-card fade-in">
                  <div className="card-top">
                    <div className="card-title">
                      <span className="card-title-icon">
                        <FaFileAlt />
                      </span>
                      <span>Recent History</span>
                    </div>

                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={onSeeAllHistory}
                    >
                      See all
                    </button>
                  </div>

                  <div className="card-divider" />

                  {historyLoading ? (
                    <div className="history-empty">
                      <div className="history-empty-icon">
                        <FaFileAlt />
                      </div>
                      <h3>Loading history...</h3>
                      <p>Please wait while we fetch your recent pickup records.</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="history-empty">
                      <div className="history-empty-icon">
                        <FaInbox />
                      </div>
                      <h3>No history yet</h3>
                      <p>
                        Your completed or past waste collection records will
                        appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Category</th>
                            <th>Type</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((item, index) => (
                            <tr
                              key={`${
                                item.history_kind || "item"
                              }-${safeDateOnly(getHistoryDate(item))}-${
                                item.type || index
                              }`}
                            >
                              <td>{formatShortDate(getHistoryDate(item))}</td>
                              <td>
                                {item.history_kind === "daily"
                                  ? "Daily Pickup"
                                  : item.history_kind === "scheduled"
                                  ? "Scheduled Pickup"
                                  : "Pickup"}
                              </td>
                              <td>{getHistoryTypeLabel(item)}</td>
                              <td>
                                <span
                                  className={`status-pill ${getStatusClass(
                                    item.status
                                  )}`}
                                >
                                  {item.status || "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bottom-side">
                <div className="quick-actions fade-in">
                  <div className="card-top">
                    <div className="card-title">
                      <span className="card-title-icon">
                        <FaRecycle />
                      </span>
                      <span>Quick Actions</span>
                    </div>
                  </div>

                  <div className="card-divider" />

                  <button
                    className="action-btn primary"
                    type="button"
                    onClick={onSchedulePickup}
                  >
                    Schedule Pickup
                  </button>

                  <button
                    className="action-btn secondary"
                    type="button"
                    onClick={onReportIssue}
                  >
                    <FaExclamationCircle style={{ marginRight: 8 }} />
                    Report Issue
                  </button>

                  <button
                    className="action-btn secondary"
                    type="button"
                    onClick={onViewReports}
                  >
                    View Reports
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "Tracking" && (
          <div className="card fade-in dash-section">
            <div className="card-top">
              <div className="card-title">
                <span className="card-title-icon">
                  <FaTruck />
                </span>
                <span>Live Map</span>
              </div>
              <span className="badge badge-green">
                {shouldShowTracking ? "Live" : hasTrackingEnded ? "Completed" : "Preview"}
              </span>
            </div>

            <div className="card-divider" />

            <div className="map-shell">
              <LiveTrackingMap />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;