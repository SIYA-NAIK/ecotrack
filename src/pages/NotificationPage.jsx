// NotificationsPage.jsx (FULL UPDATED ✅ EcoTrack)
// ✅ Loads notifications from DB
// ✅ Real-time via Socket.IO (listens to "notification")
// ✅ Refetches from DB when a socket notification arrives (best + avoids fake IDs)
// ✅ Mark one read + mark all read via backend APIs
// ✅ Clear all via backend API

import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import ResidentNavbar from "../components/ResidentNavbar";
import "../styles/notifications.css";

const API_BASE = "http://localhost:5000";

export default function NotificationsPage() {
  const stored = localStorage.getItem("user");
  const userId = stored ? JSON.parse(stored)?.id : null;

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);

  /* ==========================
     FORMAT TIME
  ========================== */
  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  /* ==========================
     FETCH NOTIFICATIONS (DB)
  ========================== */
  const fetchNotifications = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setMsg("");

      const res = await fetch(`${API_BASE}/api/notifications?userId=${userId}`);
      const data = await res.json();

      if (!res.ok) {
        setMsg(data.message || "Failed to load notifications");
        setNotifications([]);
        return;
      }

      // backend returns array
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setMsg("Server error while loading notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ==========================
     SOCKET REAL-TIME ✅
     backend emits: io.to(room).emit("notification", {...})
  ========================== */
  useEffect(() => {
    if (!userId) return;

    const socket = io(API_BASE, {
      transports: ["websocket"], // more stable on localhost
    });

    socket.on("connect", () => {
      socket.emit("joinRoom", userId);
    });

    // ✅ IMPORTANT: listen to "notification" (not newNotification)
    socket.on("notification", async (data) => {
      // toast
      showToast(data?.title || "New Notification", data?.message || "");

      // best: refetch from DB so IDs match & mark-read works
      await fetchNotifications();
    });

    socket.on("connect_error", (err) => {
      console.log("Socket connect error:", err.message);
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ==========================
     TOAST
  ========================== */
  const showToast = (title, message) => {
    setToast({ title, message });
    setTimeout(() => setToast(null), 4000);
  };

  /* ==========================
     MARK ONE READ
  ========================== */
  const markOneRead = async (id) => {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PUT",
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (e) {
      console.error("Mark read failed:", e);
    }
  };

  /* ==========================
     MARK ALL READ
  ========================== */
  const markAllRead = async () => {
    if (!userId) return;

    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        throw new Error("Failed to mark all notifications as read");
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      window.dispatchEvent(new Event("resident:notifications-updated"));
    } catch (e) {
      console.error("Mark all read failed:", e);
    }
  };

  /* ==========================
     CLEAR ALL
  ========================== */
  const clearAll = async () => {
    if (!userId) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/notifications/clear-all?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to clear notifications");
      }

      setNotifications([]);
      window.dispatchEvent(new Event("resident:notifications-updated"));
    } catch (e) {
      console.error("Clear all failed:", e);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !Number(n.is_read)).length,
    [notifications]
  );

  return (
    <>
      <ResidentNavbar />

      {/* ✅ TOAST POPUP */}
      {toast && (
        <div className="notif-toast">
          <strong>{toast.title}</strong>
          <p>{toast.message}</p>
        </div>
      )}

      <section className="notif-hero">
        <div className="notif-pill">
          <span className="pill-dot" />
          Waste Management System
        </div>

        <h1>Notifications</h1>
        <p>Stay updated with pickup alerts, reminders, and report updates.</p>
      </section>

      <div className="notif-wrap">
        <div className="notif-head">
          <div>
            <h2 className="notif-title">
              Inbox{" "}
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount} unread</span>
              )}
            </h2>
            <p className="notif-sub">Tap a notification to mark it as read.</p>
          </div>

          <div className="notif-actions">
            <button className="ghost-btn" onClick={markAllRead} type="button">
              Mark all read
            </button>

            <button className="ghost-btn danger" onClick={clearAll} type="button">
              Clear all
            </button>
          </div>
        </div>

        {loading && <p className="notif-msg">Loading...</p>}
        {msg && <p className="notif-msg">{msg}</p>}

        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty card">
              <h3>No notifications</h3>
              <p>You’re all caught up ✅</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`notif-item card ${
                  Number(n.is_read) ? "read" : "unread"
                } ${n.type || "info"}`}
                onClick={() => markOneRead(n.id)}
                type="button"
              >
                <div className="notif-item-top">
                  <div className="notif-item-title">
                    {!Number(n.is_read) && <span className="dot-live" />}
                    <span>{n.title || "Notification"}</span>
                  </div>

                  <div className="notif-time">{formatTime(n.created_at)}</div>
                </div>

                <div className="notif-body">{n.message}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
