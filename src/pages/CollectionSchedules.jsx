import React, { useEffect, useMemo, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiX } from "react-icons/fi";

const BACKEND_URL = "https://ecotrack-mqko.onrender.com";

const TYPES = ["Regular Collection", "Recycling", "Special Pickup"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Pill({ text, tone }) {
  const map = {
    green: { bg: "#dcfce7", fg: "#166534" },
    blue: { bg: "#dbeafe", fg: "#1d4ed8" },
    orange: { bg: "#ffedd5", fg: "#9a3412" },
    gray: { bg: "#e5e7eb", fg: "#334155" },
  };
  const t = map[tone] || map.gray;
  return (
    <span
      style={{
        background: t.bg,
        color: t.fg,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function typeTone(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("regular")) return "green";
  if (t.includes("recy")) return "blue";
  if (t.includes("special")) return "orange";
  return "gray";
}

function Calendar({ value, onChange }) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = d.getMonth();

  const first = new Date(y, m, 1);
  const startDay = first.getDay(); // 0=Sun
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(y, m, day));

  const monthName = d.toLocaleString("en-US", { month: "long" });

  const goPrev = () => onChange(new Date(y, m - 1, 1));
  const goNext = () => onChange(new Date(y, m + 1, 1));

  return (
    <div style={cardBox}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={goPrev} style={navBtn}>
          ‹
        </button>
        <div style={{ fontWeight: 900, color: "#0f172a" }}>
          {monthName} {y}
        </div>
        <button onClick={goNext} style={navBtn}>
          ›
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6, color: "#64748b", fontSize: 12 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((x) => (
          <div key={x} style={{ textAlign: "center", fontWeight: 800 }}>
            {x}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {cells.map((dt, idx) => {
          const active = dt && dt.getDate() === d.getDate();
          return (
            <div
              key={idx}
              style={{
                height: 34,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? "rgba(15,61,46,.12)" : "transparent",
                color: dt ? "#0f172a" : "transparent",
                fontWeight: 800,
                border: "1px solid rgba(15,23,42,.06)",
              }}
            >
              {dt ? dt.getDate() : "•"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CollectionSchedules() {
  const [date, setDate] = useState(new Date());
  const [zoneFilter, setZoneFilter] = useState("All Zones");

  const [zones, setZones] = useState(["All Zones"]);
  const [vehicles, setVehicles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [items, setItems] = useState([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // ✅ form matches DB columns
  const [form, setForm] = useState({
    zone_name: "Zone A",
    collection_type: "Regular Collection",
    pickup_days: ["Mon", "Wed", "Fri"],
    start_time: "06:00",
    end_time: "12:00",
    truck_id: "",
    staff_assigned: [],
  });

  const loadAll = async () => {
    const [z, v, s, sch] = await Promise.all([
      fetch(`${BACKEND_URL}/zones`).then((r) => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/vehicles`).then((r) => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/staff`).then((r) => r.json()).catch(() => []),
      fetch(`${BACKEND_URL}/schedules`).then((r) => r.json()).catch(() => []),
    ]);

    const zoneNames =
      Array.isArray(z) && z.length
        ? ["All Zones", ...z.map((x) => x.name || x.zone || x.zone_name).filter(Boolean)]
        : ["All Zones", "Zone A", "Zone B", "Zone C", "Zone D"];

    setZones(zoneNames);
    setVehicles(Array.isArray(v) ? v : []);
    setStaff(Array.isArray(s) ? s : []);
    setItems(Array.isArray(sch) ? sch : []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((it) => (zoneFilter === "All Zones" ? true : it.zone_name === zoneFilter));
  }, [items, zoneFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      zone_name: zoneFilter !== "All Zones" ? zoneFilter : "Zone A",
      collection_type: "Regular Collection",
      pickup_days: ["Mon", "Wed", "Fri"],
      start_time: "06:00",
      end_time: "12:00",
      truck_id: "",
      staff_assigned: [],
    });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      zone_name: row.zone_name || "Zone A",
      collection_type: row.collection_type || "Regular Collection",
      pickup_days: (row.pickup_days || "").split(",").map((x) => x.trim()).filter(Boolean),
      start_time: row.start_time || "06:00",
      end_time: row.end_time || "12:00",
      truck_id: row.truck_id || "",
      staff_assigned: (row.staff_assigned || "").split(",").map((x) => x.trim()).filter(Boolean),
    });
    setOpen(true);
  };

  const toggleDay = (d) => {
    setForm((p) => {
      const exists = p.pickup_days.includes(d);
      return { ...p, pickup_days: exists ? p.pickup_days.filter((x) => x !== d) : [...p.pickup_days, d] };
    });
  };

  const toggleStaff = (name) => {
    setForm((p) => {
      const exists = p.staff_assigned.includes(name);
      return { ...p, staff_assigned: exists ? p.staff_assigned.filter((x) => x !== name) : [...p.staff_assigned, name] };
    });
  };

  const save = async () => {
    if (!form.zone_name || !form.collection_type || !form.pickup_days.length || !form.start_time || !form.end_time) {
      alert("Zone, Type, Days, Start time and End time are required");
      return;
    }

    // ✅ payload matches DB
    const payload = {
      zone_name: form.zone_name,
      collection_type: form.collection_type,
      pickup_days: form.pickup_days.join(", "),
      start_time: form.start_time,
      end_time: form.end_time,
      truck_id: form.truck_id || null,
      staff_assigned: form.staff_assigned.join(", "),
    };

    const url = editing ? `${BACKEND_URL}/schedules/${editing.id}` : `${BACKEND_URL}/schedules`;
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.message || "Save failed");
      return;
    }

    setOpen(false);
    await loadAll();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
    await fetch(`${BACKEND_URL}/schedules/${id}`, { method: "DELETE" });
    await loadAll();
  };

  return (
    <div style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Collection Schedules</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Manage and update garbage collection schedules</div>
        </div>

        <button onClick={openAdd} style={primaryBtn}>
          <FiPlus /> Add Schedule
        </button>
      </div>

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, marginTop: 14 }}>
        {/* Left */}
        <div style={{ display: "grid", gap: 12 }}>
          <Calendar value={date} onChange={setDate} />

          <div style={cardBox}>
            <div style={{ fontWeight: 900, marginBottom: 10, color: "#0f172a" }}>Filter</div>

            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} style={input}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            <div style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
              Tip: Create schedules for each zone and assign truck + staff.
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "grid", gap: 12 }}>
          {filtered.map((it) => (
            <div key={it.id} style={cardBox}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>{it.zone_name || "Zone"}</div>
                  <div style={{ marginTop: 6 }}>
                    <Pill text={it.collection_type || "Regular Collection"} tone={typeTone(it.collection_type)} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(it)} style={iconBtn}>
                    <FiEdit2 />
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    style={{ ...iconBtn, borderColor: "rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)" }}
                  >
                    <FiTrash2 color="#ef4444" />
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, color: "#334155", fontSize: 13 }}>
                <div>🗓️ {it.pickup_days || "-"}</div>
                <div>
                  ⏰ {it.start_time || "--:--"} - {it.end_time || "--:--"}
                </div>
                <div>🚚 Truck: {it.truck_id || "-"}</div>
                <div>👥 Staff: {it.staff_assigned || "-"}</div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ ...cardBox, color: "#64748b" }}>No schedules found for this zone.</div>
          )}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: 18, padding: 16, boxShadow: "0 25px 60px rgba(0,0,0,.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>{editing ? "Edit Schedule" : "Create New Schedule"}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>Set up a new collection schedule</div>
              </div>
              <button onClick={() => setOpen(false)} style={iconBtn}>
                <FiX />
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={label}>Zone</div>
                <select value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} style={input}>
                  {zones.filter((z) => z !== "All Zones").map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Type</div>
                <select value={form.collection_type} onChange={(e) => setForm({ ...form, collection_type: e.target.value })} style={input}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Start Time</div>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} style={input} />
              </div>

              <div>
                <div style={label}>End Time</div>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} style={input} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <div style={label}>Days</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 12,
                        border: "1px solid rgba(15,23,42,.12)",
                        background: form.pickup_days.includes(d) ? "rgba(15,61,46,.12)" : "#fff",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={label}>Assign Truck</div>
                <select value={form.truck_id} onChange={(e) => setForm({ ...form, truck_id: e.target.value })} style={input}>
                  <option value="">Select truck</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.vehicle_number}>
                      {v.vehicle_number}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={label}>Staff</div>
                <div style={{ border: "1px solid rgba(15,23,42,.12)", borderRadius: 12, padding: 10, maxHeight: 140, overflow: "auto" }}>
                  {staff.map((s) => (
                    <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "6px 0" }}>
                      <input type="checkbox" checked={form.staff_assigned.includes(s.name)} onChange={() => toggleStaff(s.name)} />
                      <span style={{ fontWeight: 800 }}>{s.name}</span>
                      <span style={{ color: "#64748b" }}>({s.role})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setOpen(false)} style={secondaryBtn}>
                Cancel
              </button>
              <button onClick={save} style={primaryBtn}>
                {editing ? "Update Schedule" : "Create Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Styles */
const cardBox = {
  background: "#fff",
  border: "1px solid rgba(15,23,42,.10)",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
};

const primaryBtn = {
  background: "#0f3d2e",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 12,
  fontWeight: 900,
  display: "flex",
  gap: 8,
  alignItems: "center",
  cursor: "pointer",
};

const secondaryBtn = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  fontWeight: 900,
  cursor: "pointer",
  background: "#fff",
  color: "#0f172a",
  border: "1px solid rgba(15,23,42,.12)",
};

const iconBtn = {
  border: "1px solid rgba(15,23,42,.12)",
  background: "#fff",
  borderRadius: 12,
  padding: 10,
  cursor: "pointer",
};

const navBtn = {
  border: "1px solid rgba(15,23,42,.12)",
  background: "#fff",
  borderRadius: 10,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 900,
};

const input = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,.12)",
};

const label = {
  fontSize: 12,
  color: "#64748b",
  fontWeight: 900,
  marginBottom: 6,
};