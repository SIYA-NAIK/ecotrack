import React, { useEffect, useState } from "react";
import "./areamanagement.css";

const API = "http://localhost:5000/api";

const initialForm = {
  area: "",
  pickup_time: "",
  truck_id: "",
  driver_name: "",
  status: "Active",
};

function normalizeTimeForInput(time) {
  if (!time) return "";
  const value = String(time).trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value.slice(0, 5);
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  return value;
}

function normalizeTimeForApi(time) {
  if (!time) return "";
  const value = String(time).trim();

  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }

  return value;
}

function formatTimeForDisplay(time) {
  if (!time) return "--";
  const value = String(time).trim();

  try {
    const [hourStr, minuteStr] = value.split(":");
    let hour = Number(hourStr);
    const minute = minuteStr || "00";
    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return `${hour}:${minute} ${ampm}`;
  } catch {
    return value;
  }
}

export default function AreaManagement() {
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const fetchAreas = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/areas`);
      const data = await res.json();
      setAreas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch areas:", error);
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAreas();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

 const validateForm = () => {
  if (!form.area.trim() || !form.pickup_time.trim()) {
    alert("Area name and pickup time are required.");
    return false;
  }
  return true;
};

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload = {
      area: form.area.trim(),
      pickup_time: normalizeTimeForApi(form.pickup_time),
      truck_id: form.truck_id.trim(),
      driver_name: form.driver_name.trim(),
      status: form.status,
    };

    try {
      let res;

      if (editingId) {
        res = await fetch(`${API}/areas/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/areas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to save area");
      }

      alert(editingId ? "Area updated successfully ✅" : "Area added successfully ✅");
      resetForm();
      fetchAreas();
    } catch (error) {
      console.error("Save area error:", error);
      alert(error.message || "Failed to save area");
    }
  };

  const handleEdit = (areaItem) => {
    setEditingId(areaItem.id);
    setForm({
      area: areaItem.area || areaItem.area_name || "",
      pickup_time: normalizeTimeForInput(areaItem.pickup_time),
      truck_id: areaItem.truck_id || "",
      driver_name: areaItem.driver_name || "",
      status: areaItem.status || "Active",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this area?");
    if (!ok) return;

    try {
      const res = await fetch(`${API}/areas/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to delete area");
      }

      alert("Area deleted successfully ✅");

      if (editingId === id) {
        resetForm();
      }

      fetchAreas();
    } catch (error) {
      console.error("Delete area error:", error);
      alert(error.message || "Failed to delete area");
    }
  };

  return (
    <div className="area-page">
      <div className="area-header">
        <div>
          <h1>Area Management</h1>
          <p>Manage area-wise truck assignments and pickup timings</p>
        </div>
      </div>

      <div className="area-form-card">
        <div className="area-form">
          <input
            name="area"
            placeholder="Area Name"
            value={form.area}
            onChange={handleChange}
          />

          <input
            type="time"
            name="pickup_time"
            value={form.pickup_time}
            onChange={handleChange}
          />

          <input
            name="truck_id"
            placeholder="Truck ID"
            value={form.truck_id}
            onChange={handleChange}
          />

          <input
            name="driver_name"
            placeholder="Driver Name"
            value={form.driver_name}
            onChange={handleChange}
          />

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <button onClick={handleSubmit}>
            {editingId ? "Update Area" : "Add Area"}
          </button>
        </div>

        {editingId ? (
          <div className="area-edit-actions">
            <button className="cancel-edit-btn" onClick={resetForm}>
              Cancel Edit
            </button>
          </div>
        ) : null}
      </div>

      <div className="area-table-card">
        {loading ? (
          <div className="area-empty">Loading areas...</div>
        ) : areas.length === 0 ? (
          <div className="area-empty">No areas found.</div>
        ) : (
          <table className="area-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Pickup Time</th>
                <th>Truck</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {areas.map((areaItem) => (
                <tr key={areaItem.id}>
                  <td>{areaItem.area || areaItem.area_name}</td>
                  <td>{formatTimeForDisplay(areaItem.pickup_time)}</td>
                  <td>{areaItem.truck_id || "--"}</td>
                  <td>{areaItem.driver_name || "--"}</td>
                  <td>
                    <span
                      className={`area-status ${
                        String(areaItem.status).toLowerCase() === "active"
                          ? "active"
                          : "inactive"
                      }`}
                    >
                      {areaItem.status}
                    </span>
                  </td>
                  <td>
                    <div className="area-action-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => handleEdit(areaItem)}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(areaItem.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}