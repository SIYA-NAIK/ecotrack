import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function AdminProtectedRoute() {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const role = localStorage.getItem("role"); // should be "admin"

  if (!isLoggedIn || role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}