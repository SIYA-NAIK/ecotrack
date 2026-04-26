import React, { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import {
  FiTruck,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiAlertTriangle,
  FiRefreshCw,
} from "react-icons/fi";
import "./vehiclemanagement.css";

const API = "https://ecotrack-mqko.onrender.com/api";

const initialForm = {
  vehicle_number: "",
  driver_name: "",
  area_assigned: "",
  status: "Active",
  fuel_level: "",
  last_service_date: "",
  notes: "",
};

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [areas, setAreas] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [areaFilter, setAreaFilter] = useState("All");

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/vehicles`);
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch vehicles:", error);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async () => {
    try {
      const res = await fetch(`${API}/areas`);
      const data = await res.json();

      const normalized = Array.isArray(data)
        ? data.map((item) => ({
            id: item.id,
            area_name: item.area || item.area_name || "",
            pickup_time: item.pickup_time || "",
            driver_name: item.driver_name || "",
            status: item.status || "Active",
          }))
        : [];

      setAreas(normalized);
    } catch (error) {
      console.error("Failed to fetch areas:", error);
      setAreas([]);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch("https://ecotrack-mqko.onrender.com/staff");
      const data = await res.json();

      const normalized = Array.isArray(data)
        ? data.map((item) => ({
            id: item.id,
            name:
              item.name ||
              item.full_name ||
              item.staff_name ||
              item.driver_name ||
              "",
            role: item.role || "",
            area: item.area || item.zone || "",
            status: item.status || "",
          }))
        : [];

      setStaff(normalized);
    } catch (error) {
      console.error("Failed to fetch staff:", error);
      setStaff([]);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchVehicles(), fetchAreas(), fetchStaff()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const driverOptions = useMemo(() => {
    return staff.filter((s) => {
      const role = String(s.role || "").toLowerCase();
      const status = String(s.status || "").toLowerCase();
      return role.includes("driver") && status !== "on leave";
    });
  }, [staff]);

  const areaOptions = useMemo(() => {
    return areas.filter((a) => a.area_name);
  }, [areas]);

  const uniqueAreas = useMemo(() => {
    const fromAreas = areaOptions.map((a) => a.area_name);
    const fromVehicles = vehicles.map((v) => v.area_assigned).filter(Boolean);
    return ["All", ...new Set([...fromAreas, ...fromVehicles])];
  }, [areaOptions, vehicles]);

  const stats = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === "Active").length,
    maintenance: vehicles.filter((v) => v.status === "Maintenance").length,
    inactive: vehicles.filter((v) => v.status === "Inactive").length,
    lowFuel: vehicles.filter((v) => Number(v.fuel_level || 0) < 20).length,
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "driver_name") {
      const selectedDriver = driverOptions.find((s) => s.name === value);

      setForm((prev) => ({
        ...prev,
        driver_name: value,
        area_assigned: selectedDriver?.area || prev.area_assigned,
      }));
      return;
    }

    if (name === "area_assigned") {
      const driverInArea = driverOptions.find(
        (s) =>
          String(s.area || "").trim().toLowerCase() ===
          String(value || "").trim().toLowerCase()
      );

      setForm((prev) => ({
        ...prev,
        area_assigned: value,
        driver_name: driverInArea ? driverInArea.name : prev.driver_name,
      }));
      return;
    }

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
    if (!form.vehicle_number.trim()) {
      alert("Vehicle number is required.");
      return false;
    }

    if (!form.area_assigned.trim()) {
      alert("Area is required.");
      return false;
    }

    const fuel = form.fuel_level === "" ? 0 : Number(form.fuel_level);

    if (fuel < 0 || fuel > 100) {
      alert("Fuel level must be between 0 and 100.");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload = {
      vehicle_number: form.vehicle_number.trim().toUpperCase(),
      driver_name: form.driver_name.trim(),
      area_assigned: form.area_assigned.trim(),
      status: form.status,
      fuel_level: Number(form.fuel_level || 0),
      last_service_date: form.last_service_date || null,
      notes: form.notes.trim(),
    };

    try {
      const res = editingId
        ? await fetch(`${API}/vehicles/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`${API}/vehicles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to save vehicle");
      }

      resetForm();
      fetchVehicles();
    } catch (error) {
      alert(error.message || "Failed to save vehicle");
    }
  };

  const handleEdit = (vehicle) => {
    setEditingId(vehicle.id);

    setForm({
      vehicle_number: vehicle.vehicle_number || "",
      driver_name: vehicle.driver_name || "",
      area_assigned: vehicle.area_assigned || "",
      status: vehicle.status || "Active",
      fuel_level:
        vehicle.fuel_level === null || vehicle.fuel_level === undefined
          ? ""
          : String(vehicle.fuel_level),
      last_service_date: vehicle.last_service_date
        ? String(vehicle.last_service_date).slice(0, 10)
        : "",
      notes: vehicle.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this vehicle?");
    if (!ok) return;

    try {
      const res = await fetch(`${API}/vehicles/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete vehicle");
      }

      fetchVehicles();
    } catch (error) {
      alert(error.message || "Failed to delete vehicle");
    }
  };

  const updateQuickStatus = async (id, status) => {
    try {
      const res = await fetch(`${API}/vehicles/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      fetchVehicles();
    } catch (error) {
      alert(error.message || "Failed to update status");
    }
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const searchText = [
        vehicle.vehicle_number,
        vehicle.driver_name,
        vehicle.area_assigned,
        vehicle.notes,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchText.includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || vehicle.status === statusFilter;

      const matchesArea =
        areaFilter === "All" || vehicle.area_assigned === areaFilter;

      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [vehicles, search, statusFilter, areaFilter]);

  const getAlerts = (vehicle) => {
    const alerts = [];

    if (Number(vehicle.fuel_level || 0) < 20) alerts.push("Low Fuel");
    if (!vehicle.driver_name) alerts.push("No Driver");
    if (vehicle.status === "Maintenance") alerts.push("In Maintenance");

    return alerts;
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />

      <div className="admin-main">
        <div className="vehicle-page">
          <div className="vehicle-header">
            <div>
              <h1>Vehicle Management</h1>
              <p>Manage trucks, drivers, areas, fuel, and maintenance</p>
            </div>

            <button
              type="button"
              className="vehicle-refresh-btn"
              onClick={refreshAll}
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>

          <div className="vehicle-stats-grid">
            <div className="vehicle-stat-card">
              <h4>Total Vehicles</h4>
              <h2>{stats.total}</h2>
            </div>

            <div className="vehicle-stat-card">
              <h4>Active</h4>
              <h2>{stats.active}</h2>
            </div>

            <div className="vehicle-stat-card">
              <h4>Maintenance</h4>
              <h2>{stats.maintenance}</h2>
            </div>

            <div className="vehicle-stat-card">
              <h4>Inactive</h4>
              <h2>{stats.inactive}</h2>
            </div>

            <div className="vehicle-stat-card warning">
              <h4>Low Fuel Alerts</h4>
              <h2>{stats.lowFuel}</h2>
            </div>
          </div>

          <div className="vehicle-form-card">
            <div className="vehicle-form-grid">
              <input
                name="vehicle_number"
                placeholder="Vehicle Number"
                value={form.vehicle_number}
                onChange={handleChange}
              />

              <select
                name="driver_name"
                value={form.driver_name}
                onChange={handleChange}
              >
                <option value="">Select Driver</option>
                {driverOptions.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>

              <select
                name="area_assigned"
                value={form.area_assigned}
                onChange={handleChange}
              >
                <option value="">Select Area</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.area_name}>
                    {area.area_name}
                    {area.pickup_time ? ` (${area.pickup_time})` : ""}
                  </option>
                ))}
              </select>

              <select name="status" value={form.status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Inactive">Inactive</option>
              </select>

              <input
                type="number"
                name="fuel_level"
                placeholder="Fuel Level %"
                value={form.fuel_level}
                onChange={handleChange}
                min="0"
                max="100"
              />

              <input
                type="date"
                name="last_service_date"
                value={form.last_service_date}
                onChange={handleChange}
              />

              <textarea
                name="notes"
                placeholder="Notes / Maintenance remarks"
                value={form.notes}
                onChange={handleChange}
                rows="3"
                className="vehicle-notes"
              />

              <button type="button" onClick={handleSubmit}>
                {editingId ? "Update Vehicle" : "Add Vehicle"}
              </button>
            </div>

            {editingId && (
              <div className="vehicle-edit-actions">
                <button
                  type="button"
                  className="vehicle-cancel-btn"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              </div>
            )}
          </div>

          <div className="vehicle-filters-card">
            <div className="vehicle-search-box">
              <FiSearch className="vehicle-search-icon" />
              <input
                type="text"
                placeholder="Search by vehicle, driver, area, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              {uniqueAreas.map((area) => (
                <option key={area} value={area}>
                  {area === "All" ? "All Areas" : area}
                </option>
              ))}
            </select>
          </div>

          <div className="vehicle-table-card">
            {loading ? (
              <div className="vehicle-empty">Loading vehicles...</div>
            ) : filteredVehicles.length === 0 ? (
              <div className="vehicle-empty">No vehicles found.</div>
            ) : (
              <table className="vehicle-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Fuel</th>
                    <th>Alerts</th>
                    <th>Last Service</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredVehicles.map((vehicle) => {
                    const alerts = getAlerts(vehicle);

                    return (
                      <tr key={vehicle.id}>
                        <td className="vehicle-number-cell">
                          <FiTruck />
                          {vehicle.vehicle_number}
                        </td>

                        <td>{vehicle.driver_name || "-"}</td>
                        <td>{vehicle.area_assigned || "-"}</td>

                        <td>
                          <span
                            className={`vehicle-status ${String(
                              vehicle.status || ""
                            ).toLowerCase()}`}
                          >
                            {vehicle.status}
                          </span>

                          <div className="vehicle-quick-status">
                            <button
                              type="button"
                              className="qs active"
                              onClick={() =>
                                updateQuickStatus(vehicle.id, "Active")
                              }
                            >
                              Start
                            </button>

                            <button
                              type="button"
                              className="qs maintenance"
                              onClick={() =>
                                updateQuickStatus(vehicle.id, "Maintenance")
                              }
                            >
                              Maintenance
                            </button>

                            <button
                              type="button"
                              className="qs inactive"
                              onClick={() =>
                                updateQuickStatus(vehicle.id, "Inactive")
                              }
                            >
                              Stop
                            </button>
                          </div>
                        </td>

                        <td>{Number(vehicle.fuel_level || 0)}%</td>

                        <td>
                          {alerts.length === 0 ? (
                            <span className="alert-none">No Alerts</span>
                          ) : (
                            <div className="alert-list">
                              {alerts.map((alert) => (
                                <span
                                  key={alert}
                                  className="vehicle-alert-pill"
                                >
                                  <FiAlertTriangle />
                                  {alert}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        <td>
                          {vehicle.last_service_date
                            ? String(vehicle.last_service_date).slice(0, 10)
                            : "-"}
                        </td>

                        <td>
                          <div className="vehicle-action-buttons">
                            <button
                              type="button"
                              className="vehicle-edit-btn"
                              onClick={() => handleEdit(vehicle)}
                            >
                              <FiEdit2 />
                              Edit
                            </button>

                            <button
                              type="button"
                              className="vehicle-delete-btn"
                              onClick={() => handleDelete(vehicle.id)}
                            >
                              <FiTrash2 />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}