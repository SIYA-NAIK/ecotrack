import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaBell, FaSignOutAlt, FaUser } from "react-icons/fa";
import { io } from "socket.io-client";
import "../styles/dashboard.css";

const API_BASE = "http://localhost:5000";

function safeParseUser(rawUser) {
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function resolveAvatar(rawUser) {
  const storedAvatar = localStorage.getItem("profile_avatar");
  if (storedAvatar) return storedAvatar;

  const photo = String(rawUser?.photo || "").trim();
  if (!photo) return null;

  if (
    photo.startsWith("http://") ||
    photo.startsWith("https://") ||
    photo.startsWith("data:")
  ) {
    return photo;
  }

  return `${API_BASE}/uploads/${photo}`;
}

function readStoredResident() {
  const parsedUser = safeParseUser(localStorage.getItem("user"));
  const role = localStorage.getItem("role") || "resident";
  const name =
    parsedUser?.full_name || parsedUser?.name || parsedUser?.email || "User";

  return {
    user: {
      id: parsedUser?.id || null,
      name,
      email: parsedUser?.email || "No email",
      role,
    },
    userInitial: name.charAt(0).toUpperCase(),
    avatar: resolveAvatar(parsedUser),
  };
}

export default function ResidentNavbar({
  activeTab = "",
  onTabChange = null,
  tabs: tabsProp = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const [user, setUser] = useState({});
  const [userInitial, setUserInitial] = useState("U");
  const [showDropdown, setShowDropdown] = useState(false);

  const [theme, setTheme] = useState("light");
  const [avatar, setAvatar] = useState(null);
  const [unread, setUnread] = useState(0);

  const tabs = useMemo(
    () =>
      tabsProp || [
        "Dashboard",
        "Attendance",
        "Tracking",
        "Report Issue",
        "Schedule Pickup",
        "History",
      ],
    [tabsProp]
  );

  useEffect(() => {
    const applyStoredResident = () => {
      const next = readStoredResident();
      setUser(next.user);
      setUserInitial(next.userInitial);
      setAvatar(next.avatar);
    };

    const onStorage = (event) => {
      if (!event.key || ["user", "profile_avatar", "role"].includes(event.key)) {
        applyStoredResident();
      }
    };

    applyStoredResident();
    window.addEventListener("storage", onStorage);
    window.addEventListener("resident:user-updated", applyStoredResident);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resident:user-updated", applyStoredResident);
    };
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const initial =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
        ? "dark"
        : "light";

    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const fetchUnread = async (uid) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/notifications/unread-count?userId=${uid}`
      );
      const data = await res.json();
      if (res.ok) setUnread(Number(data.unread || 0));
    } catch {}
  };

  useEffect(() => {
    if (!user?.id) return;

    fetchUnread(user.id);

    const refreshUnread = () => fetchUnread(user.id);
    window.addEventListener("resident:notifications-updated", refreshUnread);

    const socket = io(API_BASE, { transports: ["websocket"] });

    socket.on("connect", () => {
      socket.emit("joinRoom", user.id);
    });

    socket.on("notification", () => {
      setUnread((u) => u + 1);
    });

    return () => {
      window.removeEventListener("resident:notifications-updated", refreshUnread);
      socket.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
    navigate("/login");
  };

  const go = (tab) => {
    if (onTabChange) return onTabChange(tab);

    if (tab === "Dashboard") return navigate("/dashboard");
    if (tab === "Attendance") return navigate("/attendance");
    if (tab === "Tracking") return navigate("/tracking");
    if (tab === "Report Issue") return navigate("/report-issue");
    if (tab === "Schedule Pickup") return navigate("/schedule-pickup");
    if (tab === "History") return navigate("/history");

    return navigate("/dashboard");
  };

  const onOpenNotifications = async () => {
    navigate("/notifications");
  };

  const pathToTab = (pathname) => {
    if (pathname.startsWith("/dashboard")) return "Dashboard";
    if (pathname.startsWith("/attendance")) return "Attendance";
    if (pathname.startsWith("/tracking")) return "Tracking";
    if (pathname.startsWith("/report-issue") || pathname.startsWith("/my-reports")) {
      return "Report Issue";
    }
    if (
      pathname.startsWith("/schedule-pickup") ||
      pathname.startsWith("/pickup-payment")
    ) {
      return "Schedule Pickup";
    }
    if (pathname.startsWith("/history")) return "History";
    return "";
  };

  const currentTab = activeTab || pathToTab(location.pathname);

  return (
    <div className="dash-navbar">
      <div className="nav-inner">
        <button type="button" className="logo" onClick={() => go("Dashboard")}>
          EcoTrack
        </button>

        <div className="nav-center" role="navigation">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={`nav-tab ${currentTab === t ? "active" : ""}`}
              onClick={() => go(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="nav-right">
          <button className="theme-btn" onClick={toggleTheme} type="button">
            <span className="theme-icon">{theme === "dark" ? "☀️" : "🌙"}</span>
            <span className="theme-text">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>

          <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={onOpenNotifications}
            type="button"
          >
            <FaBell className="icon" />
            {unread > 0 && <span className="dot" />}
          </button>

          <div className="profile-wrapper" ref={dropdownRef}>
            <button
              className="profile"
              onClick={() => setShowDropdown((s) => !s)}
              aria-label="Open profile menu"
              type="button"
            >
              {avatar ? (
                <img src={avatar} alt="avatar" className="nav-avatar-img" />
              ) : (
                userInitial
              )}
            </button>

            {showDropdown && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <strong>{user.name || "User"}</strong>
                  <span>{user.email || "No email"}</span>
                  <div className="role-badge resident">RESIDENT</div>
                </div>

                <div
                  className="dropdown-item"
                  onClick={() => navigate("/profile")}
                >
                  <FaUser /> View Profile
                </div>

                <div className="dropdown-item logout" onClick={handleLogout}>
                  <FaSignOutAlt /> Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
