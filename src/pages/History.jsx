import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResidentNavbar from "../components/ResidentNavbar";
import { FaHistory, FaFilter, FaInbox } from "react-icons/fa";
import "../styles/history.css";

const API_BASE = "http://localhost:5000";

export default function History() {
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const safeDateOnly = useCallback((dateStr) => {
    if (!dateStr) return "";
    const value = String(dateStr).trim();
    if (value.includes("T")) return value.split("T")[0];
    return value;
  }, []);

  const removeDuplicateHistory = useCallback((items) => {
    if (!Array.isArray(items)) return [];

    const seen = new Set();
    const cleaned = [];

    for (const item of items) {
      const date = safeDateOnly(
        item?.date || item?.due_date || item?.pickup_date || ""
      );
      const kind = String(item?.history_kind || "").toLowerCase().trim();
      const type = String(item?.type || item?.pickup_type || "").toLowerCase().trim();
      const status = String(item?.status || "").toLowerCase().trim();
      const time = String(
        item?.time || item?.start_time || item?.preferred_time || ""
      ).toLowerCase().trim();
      const address = String(item?.address || "").toLowerCase().trim();

      const uniqueKey = `${date}|${kind}|${type}|${status}|${time}|${address}`;

      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        cleaned.push(item);
      }
    }

    return cleaned;
  }, [safeDateOnly]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!userId) {
          setHistory([]);
          setLoading(false);
          return;
        }

        setLoading(true);

        const res = await fetch(`${API_BASE}/api/history/all?userId=${userId}`);
        const data = await res.json();

        if (!res.ok) {
          console.error("History fetch error:", data);
          setHistory([]);
          return;
        }

        const rawHistory = Array.isArray(data?.history) ? data.history : [];
        const uniqueHistory = removeDuplicateHistory(rawHistory);

        setHistory(uniqueHistory);
      } catch (err) {
        console.error("History fetch failed:", err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [removeDuplicateHistory, userId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";

    const value = String(dateStr).trim();

    if (value.includes("T")) {
      const only = value.split("T")[0];
      const d = new Date(`${only}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }

    const safe = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(safe.getTime())) {
      return safe.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return value;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "—";

    const value = String(timeStr).trim();

    if (
      value.toUpperCase().includes("AM") ||
      value.toUpperCase().includes("PM")
    ) {
      return value;
    }

    const parts = value.split(":");
    if (parts.length < 2) return value;

    const hh = Number(parts[0]);
    const mm = Number(parts[1]);

    if (Number.isNaN(hh) || Number.isNaN(mm)) return value;

    const date = new Date();
    date.setHours(hh, mm, 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatAmount = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return "—";
    return `₹${value.toFixed(2)}`;
  };

  const getStatusClass = (status) => {
    const value = String(status || "").toLowerCase();

    if (
      value === "completed" ||
      value === "resolved" ||
      value === "collected"
    ) {
      return "ok";
    }

    if (
      value === "missed" ||
      value === "failed" ||
      value === "cancelled"
    ) {
      return "danger";
    }

    if (
      value === "scheduled" ||
      value === "pending" ||
      value === "assigned" ||
      value === "in_progress"
    ) {
      return "pending";
    }

    return "neutral";
  };

  const getHistoryKindLabel = (kind) => {
    const value = String(kind || "").toLowerCase();
    if (value === "daily") return "Daily Pickup";
    if (value === "scheduled") return "Scheduled Pickup";
    return "Pickup";
  };

  const getHistoryDate = (item) => {
    return item?.date || item?.due_date || item?.pickup_date || null;
  };

  const getHistoryTime = (item) => {
    return item?.time || item?.start_time || item?.preferred_time || null;
  };

  const getHistoryType = (item) => {
    return item?.type || item?.pickup_type || "Mixed Waste";
  };

  const filteredHistory = useMemo(() => {
    if (filter === "all") return history;

    return history.filter(
      (item) => String(item?.history_kind || "").toLowerCase() === filter
    );
  }, [history, filter]);

  return (
    <div className="history-page">
      <ResidentNavbar
        activeTab="History"
        onTabChange={(tab) => {
          if (tab === "Dashboard") return navigate("/dashboard");
          if (tab === "Tracking") return navigate("/tracking");
          if (tab === "Report Issue") return navigate("/report-issue");
          if (tab === "Schedule Pickup") return navigate("/schedule-pickup");
          if (tab === "Attendance") return navigate("/attendance");
          if (tab === "History") return navigate("/history");
        }}
      />

      <div className="history-hero">
        <div className="history-hero-top">
          <div className="history-pill">
            <span className="history-pill-dot" />
            Resident Activity
          </div>
        </div>

        <h1 className="history-title">Pickup History</h1>
        <p className="history-subtitle">
          View your daily waste collection records and scheduled pickup history.
        </p>
      </div>

      <div className="history-container">
        <div className="history-toolbar">
          <div className="history-toolbar-left">
            <div className="history-heading">
              <span className="history-heading-icon">
                <FaHistory />
              </span>
              <div>
                <h2>All History</h2>
                <p>{filteredHistory.length} records found</p>
              </div>
            </div>
          </div>

          <div className="history-filter">
            <FaFilter />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="daily">Daily Pickups</option>
              <option value="scheduled">Scheduled Pickups</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="history-empty-card">
            <h3>Loading history...</h3>
            <p>Please wait while EcoTrack loads your pickup records.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="history-empty-card">
            <div className="history-empty-icon">
              <FaInbox />
            </div>
            <h3>No history found</h3>
            <p>
              Your completed daily pickups and scheduled pickup records will
              appear here.
            </p>

            <button
              className="history-primary-btn"
              type="button"
              onClick={() => navigate("/schedule-pickup")}
            >
              Schedule Pickup
            </button>
          </div>
        ) : (
          <div className="history-table-card">
            <div className="history-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Waste Type</th>
                    <th>Amount</th>
                    <th>Address</th>
                    <th>Notes</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistory.map((item, index) => (
                    <tr
                      key={`${
                        item?.history_kind || "history"
                      }-${safeDateOnly(getHistoryDate(item))}-${item?.id || index}-${item?.type || "type"}`}
                    >
                      <td>{getHistoryKindLabel(item?.history_kind)}</td>
                      <td>{formatDate(getHistoryDate(item))}</td>
                      <td>{formatTime(getHistoryTime(item))}</td>
                      <td>{getHistoryType(item)}</td>
                      <td>{formatAmount(item?.amount)}</td>
                      <td>{item?.address || "—"}</td>
                      <td>{item?.notes || "—"}</td>
                      <td>
                        <span
                          className={`history-status ${getStatusClass(
                            item?.status
                          )}`}
                        >
                          {item?.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
