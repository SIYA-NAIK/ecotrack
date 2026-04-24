import React, { useEffect, useMemo, useState } from "react";
import ResidentNavbar from "../components/ResidentNavbar";
import {
  FaClipboardList,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaExclamationCircle,
  FaCheckCircle,
  FaHourglassHalf,
  FaImage,
} from "react-icons/fa";
import "./myreports.css";

const API = "http://localhost:5000";

export default function MyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userId = user?.id;

    if (!userId) {
      setLoading(false);
      return;
    }

    fetch(`${API}/api/complaints/user/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.log(err);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "—";

    return d.toLocaleString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "resolved") return "resolved";
    if (s === "in_progress") return "progress";
    if (s === "rejected") return "rejected";
    return "pending";
  };

  const getPriorityClass = (priority) => {
    const p = String(priority || "").toLowerCase();
    if (p === "high") return "high";
    if (p === "low") return "low";
    return "medium";
  };

  const filteredReports = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter(
      (r) => String(r.status || "").toLowerCase() === filter
    );
  }, [reports, filter]);

  const stats = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter(
        (r) => String(r.status || "").toLowerCase() === "pending"
      ).length,
      inProgress: reports.filter(
        (r) => String(r.status || "").toLowerCase() === "in_progress"
      ).length,
      resolved: reports.filter(
        (r) => String(r.status || "").toLowerCase() === "resolved"
      ).length,
    };
  }, [reports]);

  return (
    <div className="reports-page">
      <ResidentNavbar />

      <div className="reports-hero">
        <div className="reports-hero-top">
          <div className="reports-pill">
            <span className="reports-pill-dot"></span>
            Waste Management System
          </div>
        </div>

        <h1 className="reports-title">My Reported Issues</h1>
        <p className="reports-subtitle">
          Track and monitor the garbage issues you have reported in EcoTrack.
        </p>
      </div>

      <div className="reports-stats">
        <div className="reports-stat-card">
          <div className="reports-stat-icon">
            <FaClipboardList />
          </div>
          <div>
            <span className="reports-stat-label">Total Reports</span>
            <h3>{stats.total}</h3>
          </div>
        </div>

        <div className="reports-stat-card">
          <div className="reports-stat-icon pending">
            <FaHourglassHalf />
          </div>
          <div>
            <span className="reports-stat-label">Pending</span>
            <h3>{stats.pending}</h3>
          </div>
        </div>

        <div className="reports-stat-card">
          <div className="reports-stat-icon progress">
            <FaExclamationCircle />
          </div>
          <div>
            <span className="reports-stat-label">In Progress</span>
            <h3>{stats.inProgress}</h3>
          </div>
        </div>

        <div className="reports-stat-card">
          <div className="reports-stat-icon resolved">
            <FaCheckCircle />
          </div>
          <div>
            <span className="reports-stat-label">Resolved</span>
            <h3>{stats.resolved}</h3>
          </div>
        </div>
      </div>

      <div className="reports-filters">
        {[
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "in_progress", label: "In Progress" },
          { key: "resolved", label: "Resolved" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={`reports-filter-btn ${
              filter === item.key ? "active" : ""
            }`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="reports-container">
        {loading ? (
          <div className="reports-empty-card">
            <h3>Loading reports...</h3>
            <p>Please wait while we fetch your reported issues.</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="reports-empty-card">
            <h3>No reports found</h3>
            <p>
              {reports.length === 0
                ? "Your reported waste issues will appear here once submitted."
                : "No reports match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="reports-grid">
            {filteredReports.map((report) => (
              <div className="report-card" key={report.id}>
                <div className="report-head">
                  <div className="report-id">Report #{report.id}</div>
                  <h3 className="report-issue">{report.issue_type}</h3>

                  <div className="report-badges">
                    <span
                      className={`report-priority ${getPriorityClass(
                        report.priority
                      )}`}
                    >
                      {report.priority || "medium"}
                    </span>

                    <span
                      className={`report-status ${getStatusClass(report.status)}`}
                    >
                      {String(report.status || "pending").replace("_", " ")}
                    </span>
                  </div>
                </div>

                <div className="report-meta">
                  <div className="report-meta-item">
                    <span className="report-meta-icon">
                      <FaMapMarkerAlt />
                    </span>
                    <span>{report.location || "No location"}</span>
                  </div>

                  <div className="report-meta-item">
                    <span className="report-meta-icon">
                      <FaCalendarAlt />
                    </span>
                    <span>{formatDate(report.created_at)}</span>
                  </div>
                </div>

                <div className="report-description">
                  {report.description || "No description provided."}
                </div>

                {report.photo && (
                  <div className="report-photo-wrap">
                    <div className="report-photo-label">
                      <FaImage /> Attached Photo
                    </div>
                    <img
                      src={`${API}/uploads/${report.photo}`}
                      alt={report.issue_type}
                      className="report-photo"
                    />
                  </div>
                )}

                {report.admin_remark && (
                  <div className="report-remark">
                    <div className="report-remark-title">Admin Update</div>
                    <p>{report.admin_remark}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}