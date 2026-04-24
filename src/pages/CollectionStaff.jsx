import React, { useEffect, useMemo, useState } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiX } from "react-icons/fi";

const BACKEND_URL = "http://localhost:5000";

const areasList = [
  "All Areas",
  "Kavlem",
  "Bandora",
  "Mangeshi",
  "Curti",
  "Bethoda",
  "Farmagudi",
  "Savoi Vera",
  "Borim",
];

const statusList = ["Active", "Off Duty", "On Leave"];

function Badge({ value }) {
  const v = (value || "").toLowerCase();
  const style =
    v === "active"
      ? { background: "#dcfce7", color: "#166534" }
      : v === "on leave"
      ? { background: "#fef9c3", color: "#854d0e" }
      : v === "off duty"
      ? { background: "#e5e7eb", color: "#334155" }
      : { background: "#e5e7eb", color: "#334155" };

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        ...style,
      }}
    >
      {value || "Unknown"}
    </span>
  );
}

export default function CollectionStaff() {
  const [staff, setStaff] = useState([]);
  const [q, setQ] = useState("");
  const [area, setArea] = useState("All Areas");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    role: "Collector",
    phone: "",
    email: "",
    area: "Kavlem",
    truck_id: "",
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/staff`);
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load staff failed:", error);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return staff
      .filter((s) => {
        if (area === "All Areas") return true;
        const rowArea = String(s.area || s.zone || "").trim();
        return rowArea === area;
      })
      .filter((s) => {
        if (!qq) return true;
        return (
          (s.name || "").toLowerCase().includes(qq) ||
          (s.role || "").toLowerCase().includes(qq) ||
          (s.email || "").toLowerCase().includes(qq) ||
          (s.phone || "").toLowerCase().includes(qq) ||
          (s.truck_id || "").toLowerCase().includes(qq) ||
          String(s.area || s.zone || "").toLowerCase().includes(qq) ||
          (s.status || "").toLowerCase().includes(qq)
        );
      });
  }, [staff, q, area]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      role: "Collector",
      phone: "",
      email: "",
      area: "Kavlem",
      truck_id: "",
    });
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      role: row.role || "Collector",
      phone: row.phone || "",
      email: row.email || "",
      area: row.area || row.zone || "Kavlem",
      truck_id: row.truck_id || "",
    });
    setOpen(true);
  };

  const saveStaff = async () => {
    if (!form.name.trim() || !form.role.trim()) {
      alert("Name and Role are required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      area: form.area || null,
      zone: form.area || null,
      phone: form.phone || null,
      email: form.email || null,
      truck_id: form.truck_id.trim()
        ? form.truck_id.trim().toUpperCase()
        : null,
    };

    try {
      const url = editing?.id
        ? `${BACKEND_URL}/staff/${editing.id}`
        : `${BACKEND_URL}/staff`;

      const method = editing?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save staff");
      }

      setOpen(false);
      await loadStaff();
    } catch (error) {
      console.error("Save staff failed:", error);
      alert("Save failed. Check backend terminal.");
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${BACKEND_URL}/staff/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      await loadStaff();
    } catch (error) {
      console.error("Status update failed:", error);
      alert("Status update failed. Check backend route.");
    }
  };

  const deleteStaff = async (id) => {
    if (!window.confirm("Delete this staff member?")) return;

    try {
      const res = await fetch(`${BACKEND_URL}/staff/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete staff");
      }

      await loadStaff();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Delete failed. Check backend terminal.");
    }
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: 22,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
            Collection Staff
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Manage your collection staff and assignments
          </div>
        </div>

        <button
          onClick={openAdd}
          style={{
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
          }}
        >
          <FiPlus /> Add Staff
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "#fff",
          border: "1px solid rgba(15,23,42,.10)",
          borderRadius: 16,
          padding: 12,
          boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            minWidth: 240,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,.10)",
          }}
        >
          <FiSearch color="#64748b" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff by name, role, email, truck, area..."
            style={{ border: "none", outline: "none", width: "100%" }}
          />
        </div>

        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          style={{
            border: "1px solid rgba(15,23,42,.10)",
            borderRadius: 12,
            padding: "10px 12px",
            minWidth: 160,
          }}
        >
          {areasList.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 14,
          alignItems: "start",
        }}
      >
        {loading ? (
          <div style={{ color: "#64748b", padding: 12 }}>Loading staff...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#64748b", padding: 12 }}>No staff found.</div>
        ) : (
          filtered.map((s) => (
            <div
              key={s.id}
              style={{
                background: "#fff",
                border: "1px solid rgba(15,23,42,.10)",
                borderRadius: 18,
                padding: 16,
                boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {s.name}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    {s.role}
                  </div>
                </div>
                <Badge value={s.status || "Active"} />
              </div>

              <div
                style={{
                  marginTop: 12,
                  color: "#334155",
                  fontSize: 13,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div>📍 {s.area || s.zone || "-"}</div>
                <div>📞 {s.phone || "-"}</div>
                <div>✉️ {s.email || "-"}</div>
                <div>🚚 Truck: {s.truck_id || "-"}</div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <select
                  value={s.status || "Active"}
                  onChange={(e) => updateStatus(s.id, e.target.value)}
                  style={{
                    border: "1px solid rgba(15,23,42,.10)",
                    background: "#fff",
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    minWidth: 0,
                  }}
                >
                  {statusList.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => openEdit(s)}
                  style={{
                    width: 46,
                    height: 42,
                    border: "1px solid rgba(15,23,42,.10)",
                    background: "#fff",
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Edit staff"
                >
                  <FiEdit2 />
                </button>

                <button
                  onClick={() => deleteStaff(s.id)}
                  style={{
                    width: 46,
                    height: 42,
                    border: "1px solid rgba(239,68,68,.25)",
                    background: "rgba(239,68,68,.08)",
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                  title="Delete staff"
                >
                  <FiTrash2 color="#ef4444" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {open && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
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
          <div
            style={{
              width: "min(620px, 100%)",
              background: "#fff",
              borderRadius: 18,
              padding: 16,
              boxShadow: "0 25px 60px rgba(0,0,0,.22)",
              border: "1px solid rgba(15,23,42,.10)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
                  {editing ? "Edit Staff" : "Add Staff"}
                </div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  Manage staff info and vehicle assignments
                </div>
              </div>

              <button
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid rgba(15,23,42,.12)",
                  background: "#fff",
                  borderRadius: 12,
                  padding: 10,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <FiX />
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <input
                placeholder="Name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                }}
              />

              <input
                placeholder="Role * (Driver/Collector/Supervisor)"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                }}
              />

              <input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                }}
              />

              <input
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                }}
              />

              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                  gridColumn: "1 / -1",
                }}
              >
                {areasList
                  .filter((a) => a !== "All Areas")
                  .map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
              </select>

              <input
                placeholder="Assigned Truck (ECO-001)"
                value={form.truck_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    truck_id: e.target.value.toUpperCase(),
                  })
                }
                style={{
                  gridColumn: "1 / -1",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.12)",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <button
                onClick={saveStaff}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  border: "none",
                  background: "#0f3d2e",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Note: Your backend should store staff area in column <code>area</code>.
              This code also sends <code>zone</code> = <code>area</code> for old
              compatibility.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
