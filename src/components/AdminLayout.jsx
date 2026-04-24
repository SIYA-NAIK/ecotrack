import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import AdminSidebar from "./AdminSidebar";
import AdminDashboard from "./adminDashboard";

import ReportedIssuesAdmin from "../pages/ReportedIssuesAdmin";
import CollectionSchedules from "../pages/CollectionSchedules";
import CollectionStaff from "../pages/CollectionStaff";
import CollectionStatus from "../pages/CollectionStatus";
import LiveTrackingAdmin from "../pages/LiveTrackingAdmin";
import AdminPickupRequests from "../pages/AdminPickupRequests";
import VendorManagement from "../pages/VendorManagement";
import AreaManagement from "../pages/AreaManagement";

import "./adminSidebar.css";

export default function AdminLayout() {
  return (
    <div className="adminWrap">
      <AdminSidebar />

      <main className="adminMain">
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="issues" element={<ReportedIssuesAdmin />} />
          <Route path="staff" element={<CollectionStaff />} />
          <Route path="schedules" element={<CollectionSchedules />} />
          <Route path="status" element={<CollectionStatus />} />
          <Route path="tracking" element={<LiveTrackingAdmin />} />
          <Route path="pickups" element={<AdminPickupRequests />} />
          <Route path="vendors" element={<VendorManagement />} />
          <Route path="areas" element={<AreaManagement />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
