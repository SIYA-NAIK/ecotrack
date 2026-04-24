const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const ADMIN_BACKEND_URL =
  process.env.ADMIN_BACKEND_URL || "http://localhost:5000";

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "ecotrack",
};

const DEFAULT_TRUCK_ID = process.env.DEFAULT_TRUCK_ID || "ECO-001";
const DEFAULT_USER_ID = Number(process.env.DEFAULT_USER_ID || 19);

let pool;

/* =========================
   HELPERS
========================= */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  }).toUpperCase();
}

async function safeFetch(url) {
  if (typeof fetch === "function") return fetch(url);
  const nf = require("node-fetch");
  return nf(url);
}

async function initDb() {
  pool = await mysql.createPool({
    ...DB_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const conn = await pool.getConnection();
  try {
    await conn.query("SET time_zone = '+05:30'");
  } finally {
    conn.release();
  }

  console.log("✅ Resident DB connected:", DB_CONFIG.database);
}

function getUserId(req) {
  const q = Number(req.query.userId);
  return q || DEFAULT_USER_ID;
}

function getTruckId(req) {
  return String(req.query.truckId || DEFAULT_TRUCK_ID);
}

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "EcoTrack Resident Tracker Backend",
    adminBackend: ADMIN_BACKEND_URL,
    db: DB_CONFIG.database,
  });
});

/* =========================
   FETCH LIVE TRUCKS FROM ADMIN
========================= */
async function fetchAdminLiveTrucks() {
  const r = await safeFetch(`${ADMIN_BACKEND_URL}/live-tracking`);
  if (!r.ok) throw new Error("Admin backend not reachable");
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

/* =========================
   GET LATEST SCHEDULED DESTINATION
========================= */
async function getScheduledDestination(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      pickup_address,
      pickup_lat,
      pickup_lng,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS pickup_date,
      preferred_time,
      assigned_truck_id
    FROM pickup_requests
    WHERE user_id = ?
      AND pickup_lat IS NOT NULL
      AND pickup_lng IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
    `,
    [userId]
  );

  if (!rows.length) return null;

  const r = rows[0];
  return {
    id: r.id,
    address: r.pickup_address || null,
    lat: r.pickup_lat == null ? null : Number(r.pickup_lat),
    lng: r.pickup_lng == null ? null : Number(r.pickup_lng),
    pickup_date: r.pickup_date,
    preferred_time: r.preferred_time || null,
    assigned_truck_id: r.assigned_truck_id || null,
  };
}

/* =========================
   LIVE TRACKING
========================= */
app.get("/resident/live", async (req, res) => {
  try {
    const userId = getUserId(req);
    let truckId = getTruckId(req);

    const dest = await getScheduledDestination(userId);

    if (dest?.assigned_truck_id) {
      truckId = dest.assigned_truck_id;
    }

    if (!dest || dest.lat == null || dest.lng == null) {
      return res.status(400).json({
        ok: false,
        message: "Scheduled pickup location missing for this user.",
      });
    }

    const trucks = await fetchAdminLiveTrucks();

    let truck = trucks.find((t) => String(t.truck_id) === String(truckId));

    if (!truck && trucks.length > 0) {
      truck = trucks[0];
    }

    if (!truck) {
      return res.status(404).json({
        ok: false,
        message: "Truck not found",
        truckId,
      });
    }

    const tLat = Number(truck.lat);
    const tLng = Number(truck.lng);

    if (!Number.isFinite(tLat) || !Number.isFinite(tLng)) {
      return res.json({
        ok: true,
        userId,
        truckId: truck.truck_id,
        home: {
          lat: dest.lat,
          lng: dest.lng,
          address: dest.address,
        },
        truck: {
          ...truck,
          lat: null,
          lng: null,
          speed: Number(truck.speed || 0),
        },
        distance_km: null,
        eta_min: null,
        progress: 0,
      });
    }

    const distanceKm = haversineKm(tLat, tLng, dest.lat, dest.lng);
    const speed = Number(truck.speed || 25);
    const etaMin = speed > 0 ? Math.ceil((distanceKm / speed) * 60) : null;
    const progress = clamp(Math.round((1 - distanceKm / 5) * 100), 0, 100);

    return res.json({
      ok: true,
      userId,
      truckId: truck.truck_id,
      home: {
        lat: dest.lat,
        lng: dest.lng,
        address: dest.address,
      },
      truck: {
        ...truck,
        lat: tLat,
        lng: tLng,
        speed,
        status: distanceKm <= 0.05 ? "Arrived" : truck.status || "Active",
      },
      distance_km: Number(distanceKm.toFixed(2)),
      eta_min: etaMin,
      progress,
      pickup: {
        id: dest.id,
        pickup_date: dest.pickup_date,
        preferred_time: dest.preferred_time,
      },
    });
  } catch (e) {
    console.error("❌ /resident/live error:", e.message);
    return res.status(500).json({
      ok: false,
      message: e.message,
    });
  }
});

/* =========================
   HISTORY
========================= */
app.get("/resident/history", async (req, res) => {
  try {
    const userId = getUserId(req);
    const limit = Math.min(Number(req.query.limit || 10), 50);

    const [colRows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        title,
        type,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(start_time, '%H:%i:%s') AS time,
        status
      FROM collections
      WHERE user_id = ?
        AND LOWER(status) IN ('completed','missed')
      ORDER BY due_date DESC, start_time DESC
      LIMIT ?
      `,
      [userId, limit]
    );

    const [spRows] = await pool.query(
      `
      SELECT
        id,
        user_id,
        waste_type,
        DATE_FORMAT(pickup_date, '%Y-%m-%d') AS date,
        preferred_time AS time,
        status
      FROM pickup_requests
      WHERE user_id = ?
      ORDER BY pickup_date DESC, id DESC
      LIMIT ?
      `,
      [userId, limit]
    );

    const merged = [
      ...colRows.map((r) => ({
        source: "collection",
        id: r.id,
        date: r.date,
        time: r.time,
        title: r.title || r.type || "Pickup",
        badge: r.status,
      })),
      ...spRows.map((r) => ({
        source: "special",
        id: r.id,
        date: r.date,
        time: r.time || null,
        title: `Special Pickup (${r.waste_type || "General"})`,
        badge: r.status,
      })),
    ].sort((a, b) => {
      const aKey = `${a.date || ""} ${a.time || ""}`;
      const bKey = `${b.date || ""} ${b.time || ""}`;
      return aKey < bKey ? 1 : aKey > bKey ? -1 : 0;
    });

    const groups = [];
    const map = new Map();

    for (const item of merged) {
      const key = monthLabel(item.date);
      if (!map.has(key)) {
        map.set(key, { month: key, items: [] });
        groups.push(map.get(key));
      }
      map.get(key).items.push(item);
    }

    return res.json({ ok: true, userId, groups });
  } catch (e) {
    console.error("❌ /resident/history error:", e.message);
    return res.status(500).json({ ok: false, message: e.message });
  }
});

/* =========================
   STATS
========================= */
app.get("/resident/stats", async (req, res) => {
  try {
    const userId = getUserId(req);

    const [[c1]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(LOWER(status)='completed') AS completed,
        SUM(LOWER(status)='missed') AS missed
      FROM collections
      WHERE user_id = ?
      `,
      [userId]
    );

    const [[c2]] = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        SUM(LOWER(status) IN ('completed','done')) AS completed,
        SUM(LOWER(status)='missed') AS missed
      FROM pickup_requests
      WHERE user_id = ?
      `,
      [userId]
    );

    const totalPickups = Number(c1.total || 0) + Number(c2.total || 0);
    const completed = Number(c1.completed || 0) + Number(c2.completed || 0);
    const missed = Number(c1.missed || 0) + Number(c2.missed || 0);
    const ecoScore = completed * 10 - missed * 5;

    return res.json({
      ok: true,
      userId,
      totalPickups,
      completed,
      missed,
      ecoScore: Math.max(0, ecoScore),
    });
  } catch (e) {
    console.error("❌ /resident/stats error:", e.message);
    return res.status(500).json({ ok: false, message: e.message });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = Number(process.env.PORT || 5050);

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Resident backend running on http://localhost:${PORT}`);
      console.log(`🔗 Using admin backend: ${ADMIN_BACKEND_URL}`);
    });
  })
  .catch((e) => {
    console.error("❌ DB init failed:", e.message);
    process.exit(1);
  });