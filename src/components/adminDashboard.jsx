import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./admindashboard.css";

import {
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

import {
  FiActivity,
  FiTruck,
  FiUsers,
  FiCalendar,
  FiAlertTriangle,
  FiZap,
} from "react-icons/fi";

const API = "https://ecotrack-mqko.onrender.com/api";

function chipStyle(tone) {
  const map = {
    green: { bg: "rgba(16,185,129,.12)", fg: "#065f46" },
    blue: { bg: "rgba(59,130,246,.12)", fg: "#1d4ed8" },
    orange: { bg: "rgba(245,158,11,.14)", fg: "#92400e" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#991b1b" },
    gray: { bg: "rgba(148,163,184,.18)", fg: "#334155" },
  };

  const t = map[tone] || map.gray;

  return {
    background: t.bg,
    color: t.fg,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    textTransform: "capitalize",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function vehicleStatusPill(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return chipStyle("green");
  if (s === "maintenance") return chipStyle("orange");
  if (s === "inactive") return chipStyle("red");
  return chipStyle("gray");
}

function staffPill(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return chipStyle("green");
  if (s === "off duty") return chipStyle("gray");
  if (s === "on leave") return chipStyle("orange");
  return chipStyle("gray");
}

function issuePill(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return chipStyle("orange");
  if (s === "in_progress") return chipStyle("blue");
  if (s === "resolved") return chipStyle("green");
  return chipStyle("gray");
}

/* Unique area names for each truck */
function getAreaName(area, vehicleNumber) {
  const vehicleAreaMap = {
    "ECO-001": "Kavlem",
    "ECO-002": "Bandora",
    "ECO-003": "Mangeshi",
    "ECO-004": "Curti",
    "ECO-005": "Bethoda",
    "ECO-006": "Farmagudi",
    "ECO-007": "Savoi Vera",
    "ECO-008": "Borim",
  };

  return vehicleAreaMap[vehicleNumber] || area || "-";
}

/* Staff can still use normal zone-to-area mapping */
function getStaffAreaName(zone) {
  const map = {
    "Zone A": "Kavlem",
    "Zone B": "Bandora",
    "Zone C": "Mangeshi",
    "Zone D": "Curti",
    "Zone E": "Bethoda",
    "Zone F": "Farmagudi",
    "Zone G": "Savoi Vera",
    "Zone H": "Borim",
  };

  return map[zone] || zone || "-";
}

function Card({ title, value, sub, icon }) {
  return (
    <div className="statCard">
      <div className="statTop">
        <div className="statLabel">{title}</div>
        <div className="statIcon">{icon}</div>
      </div>

      <div className="statValue">{value}</div>
      <div className="statSub">{sub}</div>
    </div>
  );
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${res.statusText} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState({
    vehicles: [],
    staff: [],
    schedules: [],
    issues: [],
  });
  const [fleet, setFleet] = useState({ stats: null, trucks: [] });

  const [refreshOn, setRefreshOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [s, r, f] = await Promise.all([
        fetchJson(`${API}/dashboard/summary`),
        fetchJson(`${API}/dashboard/recent`),
        fetchJson(`${API}/dashboard/fleet-monitor`),
      ]);

      setSummary(s);
      setRecent({
        vehicles: Array.isArray(r?.vehicles) ? r.vehicles : [],
        staff: Array.isArray(r?.staff) ? r.staff : [],
        schedules: Array.isArray(r?.schedules) ? r.schedules : [],
        issues: Array.isArray(r?.issues) ? r.issues : [],
      });

      setFleet({
        stats: f?.stats || null,
        trucks: Array.isArray(f?.trucks) ? f.trucks : [],
      });
    } catch (e) {
      console.error("Dashboard refresh failed:", e);
      setError(e.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!refreshOn) return;
    const t = setInterval(fetchAll, 5001);
    return () => clearInterval(t);
  }, [refreshOn]);

  const fleetHealth = useMemo(() => {
    const total = Number(summary?.vehicles?.total || 0);
    const active = Number(summary?.vehicles?.active || 0);
    return total ? Math.round((active / total) * 100) : 0;
  }, [summary]);

  const staffAvail = useMemo(() => {
    const total = Number(summary?.staff?.total || 0);
    const active = Number(summary?.staff?.active || 0);
    return total ? Math.round((active / total) * 100) : 0;
  }, [summary]);

  const avgSpeed = useMemo(() => {
    const v = fleet?.stats?.avg_speed;
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    return Number.isFinite(n) ? `${n} km/h` : "-";
  }, [fleet]);

  const barData = useMemo(() => {
    const v = summary?.vehicles || {};
    return [
      { status: "Active", value: Number(v.active || 0) },
      { status: "Maintenance", value: Number(v.maintenance || 0) },
      { status: "Inactive", value: Number(v.inactive || 0) },
    ];
  }, [summary]);

  if (!summary) {
    return (
      <div className="admin">
        <div className="contentArea">
          <div className="loadingText">Loading dashboard...</div>
          {error && <div className="adminError">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="contentArea">
        <div className="adminHeader">
          <div>
            <h1 className="pageTitle">Admin Dashboard</h1>
            <p className="pageSub">
              Live overview of EcoTrack (updates every 5 seconds)
            </p>
          </div>

          <div className="adminHeaderBtns">
            <button
              className={`chipBtn ${refreshOn ? "live" : ""}`}
              onClick={() => setRefreshOn((p) => !p)}
              type="button"
            >
              {refreshOn ? "● Live" : "Paused"}
            </button>

            <button
              className="chipBtn"
              onClick={fetchAll}
              disabled={loading}
              type="button"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="adminError">{error}</div>}

        <div className="stats5">
          <Card
            title="Fleet Health"
            value={`${fleetHealth}%`}
            sub="Active trucks / Total trucks"
            icon={<FiActivity />}
          />
          <Card
            title="Active Trucks"
            value={Number(summary?.vehicles?.active || 0)}
            sub="Currently running"
            icon={<FiTruck />}
          />
          <Card
            title="Staff Availability"
            value={`${staffAvail}%`}
            sub="Active staff / Total staff"
            icon={<FiUsers />}
          />
          <Card
  title="Scheduled Pickups"
  value={Number(summary?.schedules?.total || 0)}
  sub="Pickup requests received by admin"
  icon={<FiCalendar />}
/>
          <Card
            title="Issues"
            value={Number(summary?.issues?.total || 0)}
            sub="Total issues recorded"
            icon={<FiAlertTriangle />}
          />
        </div>

        <div className="grid2">
          <div className="cardBox">
            <div className="fleetHeaderRow">
              <div className="cardTitle">Fleet Monitor</div>
              <span style={chipStyle("blue")}>
                <FiZap /> Avg Speed: {avgSpeed}
              </span>
            </div>

            <div className="tableContainer">
              <table>
                <thead>
                  <tr>
                    <th>Truck</th>
                    <th>Driver</th>
                    <th>Area</th>
                    <th>Speed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.trucks.map((t) => (
                    <tr key={t.id}>
                      <td className="strongCell">{t.vehicle_number || "-"}</td>
                      <td>{t.driver_name || "-"}</td>
                      <td>{getAreaName(t.area_assigned, t.vehicle_number)}</td>
                      <td>{t.speed ?? 0} km/h</td>
                      <td>
                        <span style={vehicleStatusPill(t.status)}>
                          {t.status || "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {fleet.trucks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="emptyCell">
                        No trucks found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cardBox">
            <div className="cardTitle">Fleet Status</div>

            <div className="chartBox">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2f8f62" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="cardBox">
            <div className="cardTitleRow">
              <div className="cardTitle">Recent Issues</div>
              <button
                className="seeAllBtn"
                onClick={() => navigate("/admin/issues")}
                type="button"
              >
                See All →
              </button>
            </div>

            {recent.issues.length === 0 ? (
              <div className="miniMuted" style={{ marginTop: 10 }}>
                No complaints recorded.
              </div>
            ) : (
              <div className="issueList">
                {recent.issues.map((i) => (
                  <div key={i.id} className="issueRow">
                    <div>
                      <div className="issueTitle">{i.title || "Issue"}</div>
                      <div className="issueMeta">{i.location || "-"}</div>
                    </div>
                    <span style={issuePill(i.status)}>
                      {i.status || "unknown"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="gridRecent">
          <div className="cardBox">
            <div className="cardTitleRow">
              <div className="cardTitle">Recent Vehicles</div>
              <button
                className="seeAllBtn"
                onClick={() => navigate("/admin/tracking")}
                type="button"
              >
                See All →
              </button>
            </div>

            <div className="tableContainer">
              <table>
                <thead>
                  <tr>
                    <th>Truck</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Speed</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="strongCell">{v.vehicle_number || "-"}</td>
                      <td>{getAreaName(v.area_assigned, v.vehicle_number)}</td>
                      <td>
                        <span style={vehicleStatusPill(v.status)}>
                          {v.status || "unknown"}
                        </span>
                      </td>
                      <td>{v.speed ?? 0} km/h</td>
                    </tr>
                  ))}
                  {recent.vehicles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="emptyCell">
                        No vehicles found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cardBox">
            <div className="cardTitleRow">
              <div className="cardTitle">Recent Staff</div>
              <button
                className="seeAllBtn"
                onClick={() => navigate("/admin/staff")}
                type="button"
              >
                See All →
              </button>
            </div>

            <div className="staffList">
              {recent.staff.map((s) => (
                <div key={s.id} className="staffRow">
                  <div>
                    <div className="staffName">{s.name || "-"}</div>
                    <div className="staffMeta">
                      {s.role || "-"} • {getStaffAreaName(s.zone)}
                    </div>
                  </div>
                  <span style={staffPill(s.status)}>
                    {s.status || "unknown"}
                  </span>
                </div>
              ))}
              {recent.staff.length === 0 && (
                <div className="miniMuted">No staff found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
