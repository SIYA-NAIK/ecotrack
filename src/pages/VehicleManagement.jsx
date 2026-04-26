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
      setAreas(Array.isArray(data) ? data : []);
    } catch (error) {
      setAreas([]);
    }
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch("https://ecotrack-mqko.onrender.com/staff");
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (error) {
      setStaff([]);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchAreas();
    fetchStaff();
  }, []);

  const handleSubmit = async () => {
    const payload = {
      ...form,
      fuel_level: Number(form.fuel_level || 0),
    };

    if (editingId) {
      await fetch(`${API}/vehicles/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch(`${API}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setForm(initialForm);
    setEditingId(null);
    fetchVehicles();
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/vehicles/${id}`, { method: "DELETE" });
    fetchVehicles();
  };

  const filteredVehicles = vehicles.filter((v) => {
    return (
      (statusFilter === "All" || v.status === statusFilter) &&
      (areaFilter === "All" || v.area_assigned === areaFilter) &&
      (v.vehicle_number + v.driver_name + v.area_assigned)
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <div className="admin-layout">
      <AdminSidebar />

      <div className="admin-main">
        <h1>Vehicle Management</h1>

        {/* TABLE */}
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
            {filteredVehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.vehicle_number}</td>
                <td>{v.driver_name}</td>
                <td>{v.area_assigned}</td>

                <td>{v.status}</td>

                <td>{v.fuel_level}%</td>

                <td>
                  {v.fuel_level < 20 && (
                    <span className="alert">Low Fuel</span>
                  )}
                </td>

                <td>{v.last_service_date || "-"}</td>

                <td>
                  <button onClick={() => setForm(v)}>
                    <FiEdit2 /> Edit
                  </button>

                  <button onClick={() => handleDelete(v.id)}>
                    <FiTrash2 /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}