import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const BACKEND_URL = "https://ecotrack-mqko.onrender.com";

export default function Status() {
  const [summary, setSummary] = useState(null);
  const [lists, setLists] = useState({ vehicles: [], staff: [] });
  const [loading, setLoading] = useState(true);
  const [zoneFilter, setZoneFilter] = useState("All");
  const [refreshOn, setRefreshOn] = useState(true);

  const fetchAll = async () => {
    try {
      const [s1, s2] = await Promise.all([
        fetch(`${BACKEND_URL}/status/summary`).then((r) => r.json()),
        fetch(`${BACKEND_URL}/status/lists`).then((r) => r.json()),
      ]);
      setSummary(s1);
      setLists(s2);
      setLoading(false);
    } catch (e) {
      console.error(e);
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
    if (!summary?.vehicles?.total) return 0;
    const active = Number(summary.vehicles.active || 0);
    const total = Number(summary.vehicles.total || 0);
    return total === 0 ? 0 : Math.round((active / total) * 100);
  }, [summary]);

  const staffAvailability = useMemo(() => {
    if (!summary?.staff?.total) return 0;
    const active = Number(summary.staff.active || 0);
    const total = Number(summary.staff.total || 0);
    return total === 0 ? 0 : Math.round((active / total) * 100);
  }, [summary]);

  const vehiclePie = useMemo(() => {
    const v = summary?.vehicles || {};
    return [
      { name: "Active", value: Number(v.active || 0) },
      { name: "Maintenance", value: Number(v.maintenance || 0) },
      { name: "Inactive", value: Number(v.inactive || 0) },
    ];
  }, [summary]);

  const staffPie = useMemo(() => {
    const s = summary?.staff || {};
    return [
      { name: "Active", value: Number(s.active || 0) },
      { name: "Off Duty", value: Number(s.off_duty || 0) },
      { name: "On Leave", value: Number(s.on_leave || 0) },
    ];
  }, [summary]);

  const zones = useMemo(() => {
    const z = new Set();
    (lists.vehicles || []).forEach((v) => v.area_assigned && z.add(v.area_assigned));
    (lists.staff || []).forEach((s) => s.zone && z.add(s.zone));
    return ["All", ...Array.from(z)];
  }, [lists]);

  const filteredVehicles = useMemo(() => {
    const arr = lists.vehicles || [];
    if (zoneFilter === "All") return arr;
    return arr.filter((v) => v.area_assigned === zoneFilter);
  }, [lists, zoneFilter]);

  const filteredStaff = useMemo(() => {
    const arr = lists.staff || [];
    if (zoneFilter === "All") return arr;
    return arr.filter((s) => s.zone === zoneFilter);
  }, [lists, zoneFilter]);

  const barData = useMemo(() => {
    // simple “snapshot” bar chart
    const v = summary?.vehicles || {};
    const s = summary?.staff || {};
    return [
      { group: "Trucks", Active: Number(v.active || 0), Other: Number((v.total || 0) - (v.active || 0)) },
      { group: "Staff", Active: Number(s.active || 0), Other: Number((s.total || 0) - (s.active || 0)) },
    ];
  }, [summary]);

  if (loading) {
    return <div style={{ padding: 22, color: "#64748b", fontWeight: 800 }}>Loading status...</div>;
  }

  if (!summary) {
    return <div style={{ padding: 22, color: "#ef4444", fontWeight: 900 }}>Status API not reachable.</div>;
  }

  return (
    <div style={page}>
      {/* Top header */}
      <div style={topRow}>
        <div>
          <div style={title}>System Status</div>
          <div style={subtitle}>Real-time fleet & workforce monitoring (auto refresh every 5s)</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} style={select}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z === "All" ? "All Zones" : z}
              </option>
            ))}
          </select>

          <button onClick={() => setRefreshOn((p) => !p)} style={refreshBtn(refreshOn)}>
            {refreshOn ? "● Live" : "Paused"}
          </button>

          <button onClick={fetchAll} style={btnGhost}>Refresh</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={kpiGrid}>
        <KpiCard
          label="Fleet Health"
          value={`${fleetHealth}%`}
          sub={`${summary.vehicles.active || 0} / ${summary.vehicles.total || 0} trucks active`}
          accent="green"
        />
        <KpiCard
          label="Staff Availability"
          value={`${staffAvailability}%`}
          sub={`${summary.staff.active || 0} / ${summary.staff.total || 0} staff active`}
          accent="blue"
        />
        <KpiCard
          label="Schedules"
          value={summary.schedules.total_schedules || 0}
          sub="Total schedules configured"
          accent="orange"
        />
        <KpiCard
          label="Maintenance"
          value={summary.vehicles.maintenance || 0}
          sub="Trucks currently in maintenance"
          accent="red"
        />
      </div>

      {/* Charts + Snapshot */}
      <div style={grid2}>
        <div style={card}>
          <div style={cardHead}>
            <div style={cardTitle}>Trucks Status</div>
            <div style={chip("green")}>Live</div>
          </div>

          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={vehiclePie} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>
                  {vehiclePie.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <LegendRow items={vehiclePie} />
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div style={cardTitle}>Staff Status</div>
            <div style={chip("blue")}>Live</div>
          </div>

          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={staffPie} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>
                  {staffPie.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <LegendRow items={staffPie} />
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div style={cardTitle}>Operational Snapshot</div>
            <div style={chip("gray")}>Now</div>
          </div>

          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Active" />
                <Bar dataKey="Other" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            Active vs non-active for trucks and staff (filtered by zone)
          </div>
        </div>
      </div>

      {/* Tables */}
      <div style={grid2}>
        <div style={card}>
          <div style={cardHead}>
            <div style={cardTitle}>Fleet (Live)</div>
            <div style={muted}>{filteredVehicles.length} vehicles</div>
          </div>

          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Truck</th>
                  <th style={th}>Driver</th>
                  <th style={th}>Zone</th>
                  <th style={th}>Speed</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => (
                  <tr key={v.id}>
                    <td style={tdStrong}>{v.vehicle_number}</td>
                    <td style={td}>{v.driver_name || "-"}</td>
                    <td style={td}>{v.area_assigned || "-"}</td>
                    <td style={td}>{v.speed ?? 0} km/h</td>
                    <td style={td}>
                      <span style={statusPill(v.status)}>{v.status}</span>
                    </td>
                  </tr>
                ))}
                {filteredVehicles.length === 0 && (
                  <tr>
                    <td style={td} colSpan={5}>
                      No vehicles in this zone.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={card}>
          <div style={cardHead}>
            <div style={cardTitle}>Staff (Live)</div>
            <div style={muted}>{filteredStaff.length} staff</div>
          </div>

          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Role</th>
                  <th style={th}>Zone</th>
                  <th style={th}>Truck</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => (
                  <tr key={s.id}>
                    <td style={tdStrong}>{s.name}</td>
                    <td style={td}>{s.role}</td>
                    <td style={td}>{s.zone || "-"}</td>
                    <td style={td}>{s.truck_id || "-"}</td>
                    <td style={td}>
                      <span style={staffPill(s.status)}>{s.status}</span>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td style={td} colSpan={5}>
                      No staff in this zone.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
            Tip: update staff status (Active / Off Duty / On Leave) to see analytics change instantly.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Components ---------- */

function KpiCard({ label, value, sub, accent }) {
  return (
    <div style={{ ...kpiCard, borderColor: accentBorder(accent) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={kpiLabel}>{label}</div>
        <div style={chip(accent)}>{accent.toUpperCase()}</div>
      </div>
      <div style={kpiValue}>{value}</div>
      <div style={kpiSub}>{sub}</div>
    </div>
  );
}

function LegendRow({ items }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
      {items.map((x) => (
        <div key={x.name} style={{ display: "flex", gap: 8, alignItems: "center", color: "#0f172a", fontWeight: 800, fontSize: 13 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(15,61,46,.25)" }} />
          {x.name}: <span style={{ color: "#64748b" }}>{x.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Styles ---------- */

const page = { padding: 22 };

const topRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 };
const title = { fontSize: 20, fontWeight: 950, color: "#0f172a" };
const subtitle = { fontSize: 13, fontWeight: 800, color: "#64748b" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 10, marginBottom: 12 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 };

const card = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid rgba(15,23,42,.10)",
  padding: 14,
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
};

const cardHead = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 };
const cardTitle = { fontWeight: 950, color: "#0f172a", fontSize: 14 };
const muted = { color: "#64748b", fontWeight: 800, fontSize: 12 };

const select = { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.12)", fontWeight: 900 };

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,.12)",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const refreshBtn = (on) => ({
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,.12)",
  background: on ? "rgba(16,185,129,.10)" : "rgba(148,163,184,.15)",
  cursor: "pointer",
  fontWeight: 950,
  color: on ? "#065f46" : "#334155",
});

const kpiCard = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid rgba(15,23,42,.10)",
  padding: 14,
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
};

const kpiLabel = { color: "#64748b", fontWeight: 950, fontSize: 12 };
const kpiValue = { color: "#0f172a", fontWeight: 980, fontSize: 28, marginTop: 6 };
const kpiSub = { color: "#64748b", fontWeight: 800, fontSize: 12, marginTop: 4 };

const tableWrap = { overflow: "auto", borderRadius: 14, border: "1px solid rgba(15,23,42,.08)" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { textAlign: "left", padding: "10px 12px", background: "rgba(2,6,23,.03)", color: "#64748b", fontWeight: 950 };
const td = { padding: "10px 12px", borderTop: "1px solid rgba(15,23,42,.06)", color: "#334155", fontWeight: 800 };
const tdStrong = { ...td, color: "#0f172a", fontWeight: 950 };

function chip(tone) {
  const map = {
    green: { bg: "rgba(16,185,129,.12)", fg: "#065f46" },
    blue: { bg: "rgba(59,130,246,.12)", fg: "#1d4ed8" },
    orange: { bg: "rgba(245,158,11,.14)", fg: "#92400e" },
    red: { bg: "rgba(239,68,68,.12)", fg: "#991b1b" },
    gray: { bg: "rgba(148,163,184,.18)", fg: "#334155" },
  };
  const t = map[tone] || map.gray;
  return { padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 950, background: t.bg, color: t.fg };
}

function statusPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "active") return { ...chip("green"), textTransform: "capitalize" };
  if (s === "maintenance") return { ...chip("orange"), textTransform: "capitalize" };
  return { ...chip("red"), textTransform: "capitalize" };
}

function staffPill(status) {
  const s = (status || "").toLowerCase();
  if (s === "active") return { ...chip("green") };
  if (s === "off duty") return { ...chip("gray") };
  return { ...chip("orange") };
}

function accentBorder(accent) {
  const map = {
    green: "rgba(16,185,129,.35)",
    blue: "rgba(59,130,246,.35)",
    orange: "rgba(245,158,11,.35)",
    red: "rgba(239,68,68,.35)",
  };
  return map[accent] || "rgba(15,23,42,.10)";
}