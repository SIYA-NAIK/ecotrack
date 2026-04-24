import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiTruck,
  FiXCircle,
  FiEye,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import "./adminpickuprequests.css";

const API_ROOT = "https://ecotrack-mqko.onrender.com";
const API = `${API_ROOT}/api`;

const PAGE_SIZE = 8;

function formatDateValue(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB");
}

function normalizeStatus(status) {
  return String(status || "scheduled").toLowerCase();
}

function formatStatusLabel(status) {
  return String(status || "scheduled").replace(/_/g, " ");
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isTomorrow(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();

  const start = new Date(now);
  const day = start.getDay(); // 0 sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return d >= start && d <= end;
}

function getAreaFromItem(item) {
  if (item.area) return item.area;
  if (!item.pickup_address) return "Other";

  const knownAreas = [
    "Kavlem",
    "Bandora",
    "Mangeshi",
    "Curti",
    "Bethoda",
    "Farmagudi",
    "Savoi Vera",
    "Borim",
  ];

  const address = String(item.pickup_address).toLowerCase();
  const match = knownAreas.find((a) => address.includes(a.toLowerCase()));
  return match || "Other";
}

function compareValues(a, b, direction = "asc") {
  const valA = a ?? "";
  const valB = b ?? "";

  if (typeof valA === "number" && typeof valB === "number") {
    return direction === "asc" ? valA - valB : valB - valA;
  }

  const strA = String(valA).toLowerCase();
  const strB = String(valB).toLowerCase();

  if (strA < strB) return direction === "asc" ? -1 : 1;
  if (strA > strB) return direction === "asc" ? 1 : -1;
  return 0;
}

export default function AdminPickupRequests() {
  const [pickups, setPickups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStaffId, setBulkStaffId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState(null);

  const fetchPickups = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/pickups`);
      const data = await res.json();
      const prepared = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            area: getAreaFromItem(item),
          }))
        : [];
      setPickups(prepared);
    } catch (err) {
      console.error("Pickup fetch error:", err);
      setPickups([]);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/staff`);
      const data = await res.json();
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Staff fetch error:", err);
      setStaff([]);
    }
  }, []);

  const fetchTrucks = useCallback(async () => {
    try {
      const res = await fetch(`${API_ROOT}/vehicles`);
      const data = await res.json();
      setTrucks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Truck fetch error:", err);
      setTrucks([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPickups(), fetchStaff(), fetchTrucks()]);
    } finally {
      setLoading(false);
    }
  }, [fetchPickups, fetchStaff, fetchTrucks]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, areaFilter, dateFilter, customDate, sortBy]);

  const updatePickupStatus = async (id, status) => {
    try {
      setActionLoading(true);

      const res = await fetch(`${API}/admin/pickups/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to update status");
        return false;
      }

      setPickups((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );

      if (selectedPickup?.id === id) {
        setSelectedPickup((prev) => (prev ? { ...prev, status } : prev));
      }

      return true;
    } catch (err) {
      console.error(err);
      alert("Server error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const assignPickup = async (id, assigned_to) => {
    try {
      setActionLoading(true);

      const res = await fetch(`${API}/admin/pickups/${id}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to assign staff");
        return false;
      }

      const selectedStaff = staff.find(
        (member) => String(member.id) === String(assigned_to)
      );

      setPickups((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                assigned_to,
                staff_name: selectedStaff?.name || "Assigned",
                status: "assigned",
              }
            : item
        )
      );

      if (selectedPickup?.id === id) {
        setSelectedPickup((prev) =>
          prev
            ? {
                ...prev,
                assigned_to,
                staff_name: selectedStaff?.name || "Assigned",
                status: "assigned",
              }
            : prev
        );
      }

      return true;
    } catch (err) {
      console.error(err);
      alert("Server error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const assignTruck = async (id, truck_id) => {
    try {
      setActionLoading(true);

      const res = await fetch(`${API}/admin/pickups/${id}/assign-truck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truck_id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to assign truck");
        return false;
      }

      setPickups((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                assigned_truck_id: truck_id,
                assigned_at: new Date().toISOString(),
                status:
                  normalizeStatus(item.status) === "scheduled"
                    ? "assigned"
                    : item.status,
              }
            : item
        )
      );

      if (selectedPickup?.id === id) {
        setSelectedPickup((prev) =>
          prev
            ? {
                ...prev,
                assigned_truck_id: truck_id,
                assigned_at: new Date().toISOString(),
                status:
                  normalizeStatus(prev.status) === "scheduled"
                    ? "assigned"
                    : prev.status,
              }
            : prev
        );
      }

      return true;
    } catch (err) {
      console.error(err);
      alert("Server error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusClass = (status) => {
    const s = normalizeStatus(status);
    if (s === "scheduled") return "badge pending";
    if (s === "assigned") return "badge assigned";
    if (s === "in_progress") return "badge in_progress";
    if (s === "completed") return "badge resolved";
    if (s === "cancelled") return "badge cancelled";
    return "badge pending";
  };

  const allAreas = useMemo(() => {
    const unique = [...new Set(pickups.map((item) => item.area).filter(Boolean))];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [pickups]);

  const staffLoadMap = useMemo(() => {
    const map = {};
    staff.forEach((member) => {
      map[member.id] = 0;
    });

    pickups.forEach((item) => {
      const status = normalizeStatus(item.status);
      if (
        item.assigned_to &&
        status !== "completed" &&
        status !== "cancelled"
      ) {
        map[item.assigned_to] = (map[item.assigned_to] || 0) + 1;
      }
    });

    return map;
  }, [pickups, staff]);

  const truckLoadMap = useMemo(() => {
    const map = {};
    trucks.forEach((truck) => {
      map[truck.vehicle_number] = 0;
    });

    pickups.forEach((item) => {
      const status = normalizeStatus(item.status);
      if (
        item.assigned_truck_id &&
        status !== "completed" &&
        status !== "cancelled"
      ) {
        map[item.assigned_truck_id] = (map[item.assigned_truck_id] || 0) + 1;
      }
    });

    return map;
  }, [pickups, trucks]);

  const stats = useMemo(() => {
    const total = pickups.length;
    const scheduled = pickups.filter(
      (p) => normalizeStatus(p.status) === "scheduled"
    ).length;
    const assigned = pickups.filter(
      (p) => normalizeStatus(p.status) === "assigned"
    ).length;
    const inProgress = pickups.filter(
      (p) => normalizeStatus(p.status) === "in_progress"
    ).length;
    const completedToday = pickups.filter(
      (p) =>
        normalizeStatus(p.status) === "completed" && isToday(p.pickup_date)
    ).length;
    const cancelled = pickups.filter(
      (p) => normalizeStatus(p.status) === "cancelled"
    ).length;

    return { total, scheduled, assigned, inProgress, completedToday, cancelled };
  }, [pickups]);

  const filteredPickups = useMemo(() => {
    const q = query.trim().toLowerCase();

    let result = pickups.filter((item) => {
      const status = normalizeStatus(item.status);

      const matchesStatus =
        statusFilter === "all" ? true : status === statusFilter;

      const matchesArea =
        areaFilter === "all"
          ? true
          : String(item.area || "").toLowerCase() === areaFilter.toLowerCase();

      let matchesDate = true;
      if (dateFilter === "today") matchesDate = isToday(item.pickup_date);
      else if (dateFilter === "tomorrow") matchesDate = isTomorrow(item.pickup_date);
      else if (dateFilter === "this_week") matchesDate = isThisWeek(item.pickup_date);
      else if (dateFilter === "custom" && customDate) {
        matchesDate = String(item.pickup_date || "").slice(0, 10) === customDate;
      }

      const resident = String(item.resident_name || "").toLowerCase();
      const waste = String(item.waste_type || "").toLowerCase();
      const address = String(item.pickup_address || "").toLowerCase();
      const instructions = String(item.instructions || "").toLowerCase();
      const staffName = String(item.staff_name || "").toLowerCase();
      const assignedTruck = String(item.assigned_truck_id || "").toLowerCase();
      const area = String(item.area || "").toLowerCase();

      const matchesQuery =
        !q ||
        resident.includes(q) ||
        waste.includes(q) ||
        address.includes(q) ||
        instructions.includes(q) ||
        staffName.includes(q) ||
        assignedTruck.includes(q) ||
        area.includes(q);

      return matchesStatus && matchesArea && matchesDate && matchesQuery;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return compareValues(
          new Date(b.created_at || b.pickup_date || 0).getTime(),
          new Date(a.created_at || a.pickup_date || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "oldest") {
        return compareValues(
          new Date(a.created_at || a.pickup_date || 0).getTime(),
          new Date(b.created_at || b.pickup_date || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "pickup_date_asc") {
        return compareValues(
          new Date(a.pickup_date || 0).getTime(),
          new Date(b.pickup_date || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "pickup_date_desc") {
        return compareValues(
          new Date(b.pickup_date || 0).getTime(),
          new Date(a.pickup_date || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "resident_asc") {
        return compareValues(a.resident_name, b.resident_name, "asc");
      }

      if (sortBy === "status_asc") {
        return compareValues(a.status, b.status, "asc");
      }

      if (sortBy === "area_asc") {
        return compareValues(a.area, b.area, "asc");
      }

      return 0;
    });

    return result;
  }, [pickups, query, statusFilter, areaFilter, dateFilter, customDate, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPickups.length / PAGE_SIZE));

  const paginatedPickups = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredPickups.slice(start, end);
  }, [filteredPickups, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const allVisibleSelected =
    paginatedPickups.length > 0 &&
    paginatedPickups.every((item) => selectedIds.includes(item.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedPickups.some((item) => item.id === id))
      );
    } else {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        paginatedPickups.forEach((item) => set.add(item.id));
        return [...set];
      });
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkStaffId("");
  };

  const bulkAssign = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one pickup.");
      return;
    }

    if (!bulkStaffId) {
      alert("Please select staff for bulk assignment.");
      return;
    }

    for (const id of selectedIds) {
      await assignPickup(id, bulkStaffId);
    }

    clearSelection();
  };

  const bulkUpdateStatus = async (status) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one pickup.");
      return;
    }

    for (const id of selectedIds) {
      await updatePickupStatus(id, status);
    }

    clearSelection();
  };

  const selectedCount = selectedIds.length;

  return (
    <>
      <header className="pageHeader">
        <div>
          <h1 className="pageTitle">Pickup Requests</h1>
          <p className="pageSub">
            View, assign, track, and manage all resident scheduled pickups
          </p>
        </div>

        <button className="refreshBtn" onClick={loadAll} disabled={loading}>
          <FiRefreshCw />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* STATS */}
      <div className="statsGrid">
        <div className="statCard">
          <div className="statIcon blue">
            <FiTruck />
          </div>
          <div>
            <p className="statLabel">Total Requests</p>
            <h3>{stats.total}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon amber">
            <FiClock />
          </div>
          <div>
            <p className="statLabel">Scheduled</p>
            <h3>{stats.scheduled}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon indigo">
            <FiUsers />
          </div>
          <div>
            <p className="statLabel">Assigned</p>
            <h3>{stats.assigned}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon purple">
            <FiTruck />
          </div>
          <div>
            <p className="statLabel">In Progress</p>
            <h3>{stats.inProgress}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon green">
            <FiCheckCircle />
          </div>
          <div>
            <p className="statLabel">Completed Today</p>
            <h3>{stats.completedToday}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon red">
            <FiXCircle />
          </div>
          <div>
            <p className="statLabel">Cancelled</p>
            <h3>{stats.cancelled}</h3>
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div className="toolbarCard">
        <div className="controlsRow">
          <div className="searchBox">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by resident / waste / area / address / staff..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="filterBox">
            <FiFilter />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filterBox">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
            >
              <option value="all">All Areas</option>
              {allAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          <div className="filterBox">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="this_week">This Week</option>
              <option value="custom">Custom Date</option>
            </select>
          </div>

          {dateFilter === "custom" && (
            <div className="filterBox">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            </div>
          )}

          <div className="filterBox">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="pickup_date_asc">Pickup Date ↑</option>
              <option value="pickup_date_desc">Pickup Date ↓</option>
              <option value="resident_asc">Resident A-Z</option>
              <option value="status_asc">Status A-Z</option>
              <option value="area_asc">Area A-Z</option>
            </select>
          </div>
        </div>

        {/* BULK ACTIONS */}
        <div className="bulkBar">
          <div className="bulkLeft">
            <span className="selectedCount">{selectedCount} selected</span>
            <button className="miniBtn ghostBtn" onClick={clearSelection}>
              Clear
            </button>
          </div>

          <div className="bulkRight">
            <select
              className="bulkSelect"
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
            >
              <option value="">Assign selected to staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({staffLoadMap[member.id] || 0} active)
                </option>
              ))}
            </select>

            <button
              className="miniBtn secondaryBtn"
              onClick={bulkAssign}
              disabled={actionLoading}
            >
              Bulk Assign
            </button>

            <button
              className="miniBtn warningBtn"
              onClick={() => bulkUpdateStatus("in_progress")}
              disabled={actionLoading}
            >
              Mark In Progress
            </button>

            <button
              className="miniBtn primaryBtn"
              onClick={() => bulkUpdateStatus("completed")}
              disabled={actionLoading}
            >
              Mark Completed
            </button>

            <button
              className="miniBtn dangerBtn"
              onClick={() => bulkUpdateStatus("cancelled")}
              disabled={actionLoading}
            >
              Cancel Selected
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="tableContainer">
        <table className="pickupTable">
          <thead>
            <tr>
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </th>
              <th className="col-resident">Resident</th>
              <th className="col-waste">Waste Type</th>
              <th className="col-area">Area</th>
              <th className="col-date">Date</th>
              <th className="col-time">Time</th>
              <th className="col-address">Address</th>
              <th className="col-staff">Assigned Staff</th>
              <th className="col-truck">Assigned Truck</th>
              <th className="col-status">Status</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="11" className="tableStateCell">
                  Loading pickup requests...
                </td>
              </tr>
            ) : paginatedPickups.length === 0 ? (
              <tr>
                <td colSpan="11" className="tableStateCell">
                  No pickup requests found.
                </td>
              </tr>
            ) : (
              paginatedPickups.map((item) => {
                const status = normalizeStatus(item.status);
                const isDone = status === "completed" || status === "cancelled";

                return (
                  <tr key={item.id}>
                    <td className="cellCheck">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectOne(item.id)}
                      />
                    </td>

                    <td className="cellResident">
                      <div className="cellMain">{item.resident_name || "-"}</div>
                      <div className="cellSub">#{item.id}</div>
                    </td>

                    <td className="cellWaste">{item.waste_type || "-"}</td>

                    <td className="cellArea">{item.area || "-"}</td>

                    <td className="cellDate">
                      {formatDateValue(item.pickup_date)}
                    </td>

                    <td className="cellTime">
                      {item.preferred_time || item.time_slot || "-"}
                    </td>

                    <td className="cellAddress" title={item.pickup_address || ""}>
                      {item.pickup_address ? item.pickup_address : "-"}
                    </td>

                    <td className="cellStaff" title={item.staff_name || "Not Assigned"}>
                      {item.staff_name || "Not Assigned"}
                    </td>

                    <td
                      className="cellTruck"
                      title={item.assigned_truck_id || "Not Assigned"}
                    >
                      {item.assigned_truck_id ? (
                        <>
                          <div className="cellMain">{item.assigned_truck_id}</div>
                          <div className="cellSub">
                            {item.assigned_at
                              ? new Date(item.assigned_at).toLocaleString()
                              : "Movement active"}
                          </div>
                        </>
                      ) : (
                        "Not Assigned"
                      )}
                    </td>

                    <td className="cellStatus">
                      <span className={getStatusClass(status)}>
                        {formatStatusLabel(status)}
                      </span>
                    </td>

                    <td className="cellActions">
                      <div className="actionsWrap">
                        <button
                          className="iconBtn"
                          title="View Details"
                          onClick={() => {
                            setSelectedPickup(item);
                            setDetailsOpen(true);
                          }}
                        >
                          <FiEye />
                        </button>

                        {!isDone && (
                          <>
                            <select
                              className="staffSelect"
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignPickup(item.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                            >
                              <option value="">Assign</option>
                              {staff.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name} ({staffLoadMap[member.id] || 0})
                                </option>
                              ))}
                            </select>

                            <select
                              className="truckSelect"
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignTruck(item.id, e.target.value);
                                  e.target.value = "";
                                }
                              }}
                            >
                              <option value="">Truck</option>
                              {trucks.map((truck) => (
                                <option
                                  key={truck.id || truck.vehicle_number}
                                  value={truck.vehicle_number}
                                >
                                  {truck.vehicle_number} (
                                  {truckLoadMap[truck.vehicle_number] || 0})
                                </option>
                              ))}
                            </select>

                            {status !== "in_progress" && (
                              <button
                                className="actionBtn secondaryBtn"
                                onClick={() =>
                                  updatePickupStatus(item.id, "in_progress")
                                }
                              >
                                In Progress
                              </button>
                            )}

                            {status !== "completed" && (
                              <button
                                className="actionBtn primaryBtn"
                                onClick={() =>
                                  updatePickupStatus(item.id, "completed")
                                }
                              >
                                Complete
                              </button>
                            )}

                            <button
                              className="actionBtn dangerBtn"
                              onClick={() =>
                                updatePickupStatus(item.id, "cancelled")
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {isDone && (
                          <span className="doneText">
                            {status === "completed" ? "Completed" : "Cancelled"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER / PAGINATION */}
      <div className="tableFooter">
        <div className="footerLeft">
          Showing{" "}
          <strong>
            {filteredPickups.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
          </strong>{" "}
          to{" "}
          <strong>
            {Math.min(currentPage * PAGE_SIZE, filteredPickups.length)}
          </strong>{" "}
          of <strong>{filteredPickups.length}</strong> results
        </div>

        <div className="pagination">
          <button
            className="pageBtn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <FiChevronLeft />
          </button>

          <span className="pageInfo">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pageBtn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <FiChevronRight />
          </button>
        </div>
      </div>

      {/* DETAILS MODAL */}
      {detailsOpen && selectedPickup && (
        <div className="modalOverlay" onClick={() => setDetailsOpen(false)}>
          <div
            className="detailsModal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <h2>Pickup Request Details</h2>
                <p>Request #{selectedPickup.id}</p>
              </div>
              <button
                className="closeBtn"
                onClick={() => setDetailsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="detailsGrid">
              <div className="detailItem">
                <span>Resident</span>
                <strong>{selectedPickup.resident_name || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Waste Type</span>
                <strong>{selectedPickup.waste_type || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Area</span>
                <strong>{selectedPickup.area || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Status</span>
                <strong>
                  <span className={getStatusClass(selectedPickup.status)}>
                    {formatStatusLabel(selectedPickup.status)}
                  </span>
                </strong>
              </div>

              <div className="detailItem">
                <span>Pickup Date</span>
                <strong>{formatDateValue(selectedPickup.pickup_date)}</strong>
              </div>

              <div className="detailItem">
                <span>Preferred Time</span>
                <strong>
                  {selectedPickup.preferred_time ||
                    selectedPickup.time_slot ||
                    "-"}
                </strong>
              </div>

              <div className="detailItem full">
                <span>Pickup Address</span>
                <strong>{selectedPickup.pickup_address || "-"}</strong>
              </div>

              <div className="detailItem full">
                <span>Instructions</span>
                <strong>{selectedPickup.instructions || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Assigned Staff</span>
                <strong>{selectedPickup.staff_name || "Not Assigned"}</strong>
              </div>

              <div className="detailItem">
                <span>Assigned Truck</span>
                <strong>{selectedPickup.assigned_truck_id || "Not Assigned"}</strong>
              </div>

              <div className="detailItem">
                <span>Created At</span>
                <strong>
                  {selectedPickup.created_at
                    ? new Date(selectedPickup.created_at).toLocaleString()
                    : "-"}
                </strong>
              </div>
            </div>

            <div className="modalActions">
              <select
                className="staffSelect modalSelect"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignPickup(selectedPickup.id, e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Assign Staff</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({staffLoadMap[member.id] || 0} active)
                  </option>
                ))}
              </select>

              <select
                className="truckSelect modalSelect"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignTruck(selectedPickup.id, e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Assign Truck</option>
                {trucks.map((truck) => (
                  <option
                    key={truck.id || truck.vehicle_number}
                    value={truck.vehicle_number}
                  >
                    {truck.vehicle_number} ({truckLoadMap[truck.vehicle_number] || 0} active)
                  </option>
                ))}
              </select>

              <button
                className="actionBtn secondaryBtn"
                onClick={() => updatePickupStatus(selectedPickup.id, "in_progress")}
              >
                In Progress
              </button>

              <button
                className="actionBtn primaryBtn"
                onClick={() => updatePickupStatus(selectedPickup.id, "completed")}
              >
                Complete
              </button>

              <button
                className="actionBtn dangerBtn"
                onClick={() => updatePickupStatus(selectedPickup.id, "cancelled")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
