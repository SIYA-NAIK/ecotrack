import React, { useMemo, useEffect, useState } from "react";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiAlertTriangle,
  FiClock,
  FiActivity,
  FiCheckCircle,
  FiEye,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import "./reportedissuesadmin.css";

const API_BASE = "http://localhost:5000";
const PAGE_SIZE = 8;

function normalizeStatus(issue) {
  return String(issue.status || "pending").toLowerCase();
}

function formatStatusLabel(status) {
  return String(status || "pending").replace(/_/g, " ");
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function ReportedIssuesAdmin() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  const fetchIssues = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/admin/complaints`);
      const data = await res.json();
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching complaints:", err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, typeFilter, sortBy]);

  const updateStatus = async (id, status) => {
    try {
      setActionLoading(true);

      const res = await fetch(`${API_BASE}/api/admin/complaints/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Update failed");
        return false;
      }

      setIssues((prev) =>
        prev.map((x) => (x.id === id ? { ...x, status } : x))
      );

      if (selectedIssue?.id === id) {
        setSelectedIssue((prev) => (prev ? { ...prev, status } : prev));
      }

      return true;
    } catch (e) {
      console.error(e);
      alert("Server error");
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "pending") return "badge pending";
    if (s === "in_progress") return "badge in_progress";
    if (s === "resolved") return "badge resolved";
    return "badge pending";
  };

  const allTypes = useMemo(() => {
    const unique = [
      ...new Set(
        issues
          .map((issue) => String(issue.issue_type || "").trim())
          .filter(Boolean)
      ),
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [issues]);

  const stats = useMemo(() => {
    const total = issues.length;
    const pending = issues.filter((i) => normalizeStatus(i) === "pending").length;
    const inProgress = issues.filter(
      (i) => normalizeStatus(i) === "in_progress"
    ).length;
    const resolved = issues.filter((i) => normalizeStatus(i) === "resolved").length;

    return { total, pending, inProgress, resolved };
  }, [issues]);

  const filteredIssues = useMemo(() => {
    const q = query.trim().toLowerCase();

    let result = issues.filter((issue) => {
      const status = normalizeStatus(issue);
      const matchesStatus =
        statusFilter === "all" ? true : status === statusFilter;

      const type = String(issue.issue_type || "").trim();
      const matchesType = typeFilter === "all" ? true : type === typeFilter;

      const location = String(issue.location || "").toLowerCase();
      const issueType = String(issue.issue_type || "").toLowerCase();
      const reporter = String(issue.citizen_name || "").toLowerCase();
      const description = String(issue.description || "").toLowerCase();

      const matchesQuery =
        !q ||
        location.includes(q) ||
        issueType.includes(q) ||
        reporter.includes(q) ||
        description.includes(q);

      return matchesStatus && matchesType && matchesQuery;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "newest") {
        return compareValues(
          new Date(b.created_at || 0).getTime(),
          new Date(a.created_at || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "oldest") {
        return compareValues(
          new Date(a.created_at || 0).getTime(),
          new Date(b.created_at || 0).getTime(),
          "asc"
        );
      }

      if (sortBy === "location_asc") {
        return compareValues(a.location, b.location, "asc");
      }

      if (sortBy === "type_asc") {
        return compareValues(a.issue_type, b.issue_type, "asc");
      }

      if (sortBy === "reporter_asc") {
        return compareValues(a.citizen_name, b.citizen_name, "asc");
      }

      if (sortBy === "status_asc") {
        return compareValues(a.status, b.status, "asc");
      }

      return 0;
    });

    return result;
  }, [issues, query, statusFilter, typeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / PAGE_SIZE));

  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredIssues.slice(start, end);
  }, [filteredIssues, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const allVisibleSelected =
    paginatedIssues.length > 0 &&
    paginatedIssues.every((issue) => selectedIds.includes(issue.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !paginatedIssues.some((issue) => issue.id === id))
      );
    } else {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        paginatedIssues.forEach((issue) => set.add(issue.id));
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
  };

  const bulkUpdateStatus = async (status) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one issue.");
      return;
    }

    for (const id of selectedIds) {
      await updateStatus(id, status);
    }

    clearSelection();
  };

  const selectedCount = selectedIds.length;

  return (
    <div className="reportedIssuesAdminPage">
      <header className="pageHeader">
        <div>
          <h1 className="pageTitle">Reported Issues</h1>
          <p className="pageSub">
            View, monitor, and manage all garbage collection complaints
          </p>
        </div>

        <button className="refreshBtn" onClick={fetchIssues} disabled={loading}>
          <FiRefreshCw />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <div className="statsGrid">
        <div className="statCard">
          <div className="statIcon amber">
            <FiAlertTriangle />
          </div>
          <div>
            <p className="statLabel">Total Issues</p>
            <h3>{stats.total}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon red">
            <FiClock />
          </div>
          <div>
            <p className="statLabel">Pending</p>
            <h3>{stats.pending}</h3>
          </div>
        </div>

        <div className="statCard">
          <div className="statIcon blue">
            <FiActivity />
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
            <p className="statLabel">Resolved</p>
            <h3>{stats.resolved}</h3>
          </div>
        </div>
      </div>

      <div className="toolbarCard">
        <div className="controlsRow">
          <div className="searchBox">
            <FiSearch />
            <input
              type="text"
              placeholder="Search by location / type / reporter / description..."
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
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="filterBox">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {allTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="filterBox">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="location_asc">Location A-Z</option>
              <option value="type_asc">Type A-Z</option>
              <option value="reporter_asc">Reporter A-Z</option>
              <option value="status_asc">Status A-Z</option>
            </select>
          </div>
        </div>

        <div className="bulkBar">
          <div className="bulkLeft">
            <span className="selectedCount">{selectedCount} selected</span>
            <button className="miniBtn ghostBtn" onClick={clearSelection}>
              Clear
            </button>
          </div>

          <div className="bulkRight">
            <button
              className="miniBtn secondaryBtn"
              onClick={() => bulkUpdateStatus("in_progress")}
              disabled={actionLoading}
            >
              Mark In Progress
            </button>

            <button
              className="miniBtn primaryBtn"
              onClick={() => bulkUpdateStatus("resolved")}
              disabled={actionLoading}
            >
              Mark Resolved
            </button>
          </div>
        </div>
      </div>

      <div className="tableContainer">
        <table className="issuesTable">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </th>
              <th>LOCATION</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>REPORTER</th>
              <th>REPORTED AT</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="tableStateCell">
                  Loading...
                </td>
              </tr>
            ) : paginatedIssues.length === 0 ? (
              <tr>
                <td colSpan="7" className="tableStateCell">
                  No issues found.
                </td>
              </tr>
            ) : (
              paginatedIssues.map((issue) => {
                const status = normalizeStatus(issue);

                return (
                  <tr key={issue.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(issue.id)}
                        onChange={() => toggleSelectOne(issue.id)}
                      />
                    </td>

                    <td className="cellLocation" title={issue.location || "-"}>
                      {issue.location || "-"}
                    </td>

                    <td className="cellType" title={issue.issue_type || "-"}>
                      {issue.issue_type || "-"}
                    </td>

                    <td className="cellStatus">
                      <span className={getStatusClass(status)}>
                        {formatStatusLabel(status)}
                      </span>
                    </td>

                    <td className="cellReporter" title={issue.citizen_name || "-"}>
                      {issue.citizen_name || "-"}
                    </td>

                    <td className="cellDate">{formatDate(issue.created_at)}</td>

                    <td className="cellActions">
                      <div className="actionGroup">
                        <button
                          className="iconBtn"
                          title="View Details"
                          onClick={() => {
                            setSelectedIssue(issue);
                            setDetailsOpen(true);
                          }}
                        >
                          <FiEye />
                        </button>

                        {status !== "resolved" ? (
                          <>
                            <button
                              className="actionBtn secondaryBtn"
                              onClick={() =>
                                updateStatus(issue.id, "in_progress")
                              }
                            >
                              In Progress
                            </button>

                            <button
                              className="actionBtn primaryBtn"
                              onClick={() => updateStatus(issue.id, "resolved")}
                            >
                              Resolve
                            </button>
                          </>
                        ) : (
                          <span className="resolvedText">Resolved</span>
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

      <div className="tableFooter">
        <div className="footerLeft">
          Showing{" "}
          <strong>
            {filteredIssues.length === 0
              ? 0
              : (currentPage - 1) * PAGE_SIZE + 1}
          </strong>{" "}
          to{" "}
          <strong>
            {Math.min(currentPage * PAGE_SIZE, filteredIssues.length)}
          </strong>{" "}
          of <strong>{filteredIssues.length}</strong> results
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

      {detailsOpen && selectedIssue && (
        <div className="modalOverlay" onClick={() => setDetailsOpen(false)}>
          <div className="detailsModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <h2>Issue Details</h2>
                <p>Complaint #{selectedIssue.id}</p>
              </div>
              <button className="closeBtn" onClick={() => setDetailsOpen(false)}>
                ×
              </button>
            </div>

            <div className="detailsGrid">
              <div className="detailItem">
                <span>Location</span>
                <strong>{selectedIssue.location || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Issue Type</span>
                <strong>{selectedIssue.issue_type || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Status</span>
                <strong>
                  <span className={getStatusClass(selectedIssue.status)}>
                    {formatStatusLabel(selectedIssue.status)}
                  </span>
                </strong>
              </div>

              <div className="detailItem">
                <span>Reporter</span>
                <strong>{selectedIssue.citizen_name || "-"}</strong>
              </div>

              <div className="detailItem">
                <span>Reported At</span>
                <strong>{formatDate(selectedIssue.created_at)}</strong>
              </div>

              <div className="detailItem full">
                <span>Description</span>
                <strong>{selectedIssue.description || "-"}</strong>
              </div>
            </div>

            <div className="modalActions">
              <button
                className="actionBtn secondaryBtn"
                onClick={() => updateStatus(selectedIssue.id, "in_progress")}
              >
                In Progress
              </button>

              <button
                className="actionBtn primaryBtn"
                onClick={() => updateStatus(selectedIssue.id, "resolved")}
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}