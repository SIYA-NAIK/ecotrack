import React, { useEffect } from "react";
import { FiMap } from "react-icons/fi";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  FiGrid,
  FiAlertTriangle,
  FiUsers,
  FiClipboard,
  FiMapPin,
  FiLogOut,
  FiTruck,   // ✅ Vendor icon
} from "react-icons/fi";
import "./adminSidebar.css";

export default function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/admin") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  const logout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }) => (isActive ? "aLink active" : "aLink");

  return (
    <aside className="aSidebar">

      {/* Brand */}
      <div className="aBrand" onClick={() => navigate("/admin/dashboard")}>
        <div className="aLogoDot" />
        <div className="aBrandText">
          <div className="aBrandTitle">EcoTrackPonda</div>
          <div className="aBrandSub">Admin</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="aNav">

        <NavLink to="/admin/dashboard" className={linkClass}>
          <FiGrid className="aIco" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/admin/users">User Management</NavLink>

        <NavLink to="/admin/issues" className={linkClass}>
          <FiAlertTriangle className="aIco" />
          <span>Reported Issues</span>
        </NavLink>

        <NavLink to="/admin/staff" className={linkClass}>
          <FiUsers className="aIco" />
          <span>Collection Staff</span>
        </NavLink>

        <NavLink to="/admin/pickups" className={linkClass}>
          <FiClipboard className="aIco" />
          <span>Pickup Requests</span>
        </NavLink>

        {/* ✅ NEW Vendor Management */}
        <NavLink to="/admin/vendors" className={linkClass}>
          <FiTruck className="aIco" />
          <span>Vendors</span>
        </NavLink>

        <NavLink to="/admin/areas" className={linkClass}>
  <FiMap className="aIco" />
  <span>Area Management</span>
</NavLink>

<NavLink to="/admin/vehicles" className={linkClass}>
  <FiTruck className="aIco" />
  <span>Vehicles</span>
</NavLink>

        <NavLink to="/admin/tracking" className={linkClass}>
          <FiMapPin className="aIco" />
          <span>Live Tracking</span>
        </NavLink>

      </nav>

      {/* Logout */}
      <button type="button" className="aLogout" onClick={logout}>
        <FiLogOut className="aIco" />
        <span>Logout</span>
      </button>

    </aside>
  );
}