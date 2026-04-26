import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_BASE = "https://ecotrack-mqko.onrender.com";
const API = `${API_BASE}/api`;
const POLL_MS = 15000;

const ResidentDataContext = createContext(null);

function safeParseUser(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readUserFromStorage() {
  return safeParseUser(localStorage.getItem("user"));
}

async function getJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || text || `Request failed (${res.status})`);
  }

  return data;
}

export function ResidentDataProvider({ children }) {
  const [user, setUser] = useState(() => readUserFromStorage());
  const [avatar, setAvatar] = useState(
    () => localStorage.getItem("profile_avatar") || null
  );

  const [nextPickup, setNextPickup] = useState(null);
  const [upcomingPickups, setUpcomingPickups] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [tracking, setTracking] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState({
    pickups: false,
    history: false,
    tracking: false,
    notifications: false,
  });

  const [errors, setErrors] = useState({
    pickups: "",
    history: "",
    tracking: "",
    notifications: "",
  });

  const userId = useMemo(() => {
    const id = Number(user?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [user]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !Number(n.is_read)).length,
    [notifications]
  );

  const refreshUserFromStorage = useCallback(() => {
    setUser(readUserFromStorage());
    setAvatar(localStorage.getItem("profile_avatar") || null);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || ["user", "profile_avatar", "role"].includes(e.key)) {
        refreshUserFromStorage();
      }
    };

    const onFocus = () => refreshUserFromStorage();
    const onLocalUpdate = () => refreshUserFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    window.addEventListener("resident:user-updated", onLocalUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("resident:user-updated", onLocalUpdate);
    };
  }, [refreshUserFromStorage]);

  const refreshPickups = useCallback(async () => {
    if (!userId) {
      setNextPickup(null);
      setUpcomingPickups([]);
      setErrors((prev) => ({ ...prev, pickups: "" }));
      return;
    }

    setLoading((prev) => ({ ...prev, pickups: true }));
    setErrors((prev) => ({ ...prev, pickups: "" }));

    try {
      const [nextResult, upcomingResult] = await Promise.allSettled([
        getJson(`${API_BASE}/api/pickups/next?userId=${userId}`),
        getJson(`${API_BASE}/api/pickups/upcoming/${userId}`),
      ]);

      if (nextResult.status === "fulfilled") {
        setNextPickup(nextResult.value?.nextPickup || null);
      } else {
        setNextPickup(null);
      }

      if (upcomingResult.status === "fulfilled") {
        setUpcomingPickups(
          Array.isArray(upcomingResult.value) ? upcomingResult.value : []
        );
      } else {
        setUpcomingPickups([]);
      }
    } catch (e) {
      setNextPickup(null);
      setUpcomingPickups([]);
      setErrors((prev) => ({
        ...prev,
        pickups: String(e?.message || e),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, pickups: false }));
    }
  }, [userId]);

  const refreshHistory = useCallback(async () => {
    if (!userId) {
      setRecentHistory([]);
      setErrors((prev) => ({ ...prev, history: "" }));
      return;
    }

    setLoading((prev) => ({ ...prev, history: true }));
    setErrors((prev) => ({ ...prev, history: "" }));

    try {
      const data = await getJson(
        `${API_BASE}/api/history/recent?userId=${userId}&limit=8`
      );
      setRecentHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (e) {
      setRecentHistory([]);
      setErrors((prev) => ({
        ...prev,
        history: String(e?.message || e),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, history: false }));
    }
  }, [userId]);

  const refreshTracking = useCallback(async () => {
    if (!userId) {
      setTracking(null);
      setErrors((prev) => ({ ...prev, tracking: "" }));
      return;
    }

    setLoading((prev) => ({ ...prev, tracking: true }));
    setErrors((prev) => ({ ...prev, tracking: "" }));

    try {
      const data = await getJson(`${API_BASE}/api/tracking/live?userId=${userId}`);
      setTracking(data?.tracking || null);
    } catch (e) {
      setTracking(null);
      setErrors((prev) => ({
        ...prev,
        tracking: String(e?.message || e),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, tracking: false }));
    }
  }, [userId]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setErrors((prev) => ({ ...prev, notifications: "" }));
      return;
    }

    setLoading((prev) => ({ ...prev, notifications: true }));
    setErrors((prev) => ({ ...prev, notifications: "" }));

    try {
      const data = await getJson(`${API_BASE}/api/notifications?userId=${userId}`);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotifications([]);
      setErrors((prev) => ({
        ...prev,
        notifications: String(e?.message || e),
      }));
    } finally {
      setLoading((prev) => ({ ...prev, notifications: false }));
    }
  }, [userId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshPickups(),
      refreshHistory(),
      refreshTracking(),
      refreshNotifications(),
    ]);
  }, [refreshHistory, refreshNotifications, refreshPickups, refreshTracking]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      refreshAll();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [userId, refreshAll]);

  const markNotificationRead = useCallback(async (id) => {
    if (!id) return;
    try {
      await getJson(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PUT",
      });
    } catch {
      // Keep local optimistic update even if request fails.
    } finally {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !Number(n.is_read));
    await Promise.all(unread.map((n) => markNotificationRead(n.id)));
  }, [markNotificationRead, notifications]);

  const clearNotificationsLocal = useCallback(() => {
    setNotifications([]);
  }, []);

  const updateUser = useCallback((nextUserOrUpdater) => {
    const current = readUserFromStorage() || {};
    const next =
      typeof nextUserOrUpdater === "function"
        ? nextUserOrUpdater(current)
        : { ...current, ...(nextUserOrUpdater || {}) };

    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
    window.dispatchEvent(new Event("resident:user-updated"));
    return next;
  }, []);

  const updateAvatar = useCallback((nextAvatar) => {
    if (nextAvatar) {
      localStorage.setItem("profile_avatar", nextAvatar);
      setAvatar(nextAvatar);
    } else {
      localStorage.removeItem("profile_avatar");
      setAvatar(null);
    }
    window.dispatchEvent(new Event("resident:user-updated"));
  }, []);

  const value = useMemo(
    () => ({
      user,
      userId,
      avatar,
      nextPickup,
      upcomingPickups,
      recentHistory,
      tracking,
      notifications,
      unreadNotifications,
      loading,
      errors,
      refreshAll,
      refreshPickups,
      refreshHistory,
      refreshTracking,
      refreshNotifications,
      refreshUserFromStorage,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotificationsLocal,
      updateUser,
      updateAvatar,
    }),
    [
      avatar,
      clearNotificationsLocal,
      errors,
      loading,
      markAllNotificationsRead,
      markNotificationRead,
      nextPickup,
      notifications,
      recentHistory,
      refreshAll,
      refreshHistory,
      refreshNotifications,
      refreshPickups,
      refreshTracking,
      refreshUserFromStorage,
      tracking,
      unreadNotifications,
      upcomingPickups,
      updateAvatar,
      updateUser,
      user,
      userId,
    ]
  );

  return (
    <ResidentDataContext.Provider value={value}>
      {children}
    </ResidentDataContext.Provider>
  );
}

export function useResidentData() {
  const value = useContext(ResidentDataContext);
  if (!value) {
    throw new Error("useResidentData must be used inside ResidentDataProvider");
  }
  return value;
}
