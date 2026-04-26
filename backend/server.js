// server.js (FULL UPDATED ✅ EcoTrack) - DB: ecotrack
// ✅ Uses `complaints` table for Report Issue flow
// ✅ Adds Admin complaints APIs + Notifications APIs
// ✅ FIXED Admin Schedule Pickup APIs to use pickup_requests table
// ✅ UPDATED Dashboard summary to count pickup_requests
// ✅ UPDATED Attendance -> Daily History sync using collections table
// ✅ Daily pickup appears in History as Collected by default
// ✅ If marked missed, same day changes to Missed in History
// ✅ Pickup notifications added for schedule / assign / status updates
// ✅ FIXED duplicate daily pickup creation
// ✅ FIXED history duplicate rows
// ✅ STANDARDIZED daily pickup type = Mixed Waste

require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* =======================
   ✅ MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());

/* =======================
   ✅ ENSURE UPLOADS FOLDER EXISTS
======================= */
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

/* =======================
   ✅ MULTER STORAGE (for photos)
======================= */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));

/* =======================
   ✅ MYSQL CONNECTION (DB = ecotrack ✅)
======================= */
const db = mysql.createConnection({
  host: "metro.proxy.rlwy.net",
  user: "root",
  password: "nnvkwRxsbezBZPWlXvqFYnwjYnqKaqjB",
  database: "railway",
  port: 49010,
});
function ensurePickupRequestTrackingColumns() {
  db.query("SHOW COLUMNS FROM pickup_requests", (err, rows) => {
    if (err) {
      console.error("❌ pickup_requests schema read failed:", err.message);
      return;
    }

    const existing = new Set((rows || []).map((row) => row.Field));
    const missing = [];

    if (!existing.has("pickup_lat")) {
      missing.push("ADD COLUMN pickup_lat DECIMAL(10,7) NULL");
    }
    if (!existing.has("pickup_lng")) {
      missing.push("ADD COLUMN pickup_lng DECIMAL(10,7) NULL");
    }
    if (!existing.has("assigned_truck_id")) {
      missing.push("ADD COLUMN assigned_truck_id VARCHAR(50) NULL");
    }
    if (!existing.has("assigned_at")) {
      missing.push("ADD COLUMN assigned_at DATETIME NULL");
    }

    if (!missing.length) {
      console.log("✅ pickup_requests tracking columns ready");
      return;
    }

    db.query(
      `ALTER TABLE pickup_requests ${missing.join(", ")}`,
      (alterErr) => {
        if (alterErr) {
          console.error(
            "❌ pickup_requests tracking column init failed:",
            alterErr.message
          );
          return;
        }

        console.log("✅ pickup_requests tracking columns added");
      }
    );
  });
}

function ensureResidentVerificationColumns() {
  db.query("SHOW COLUMNS FROM residents", (err, rows) => {
    if (err) {
      console.error("❌ residents schema read failed:", err.message);
      return;
    }

    const existing = new Set((rows || []).map((row) => row.Field));
    const missing = [];

    if (!existing.has("street")) {
      missing.push("ADD COLUMN street VARCHAR(255) NULL");
    }
    if (!existing.has("apt")) {
      missing.push("ADD COLUMN apt VARCHAR(255) NULL");
    }
    if (!existing.has("state_name")) {
      missing.push("ADD COLUMN state_name VARCHAR(120) NULL");
    }
    if (!existing.has("pincode")) {
      missing.push("ADD COLUMN pincode VARCHAR(10) NULL");
    }
    if (!existing.has("country")) {
      missing.push("ADD COLUMN country VARCHAR(80) NULL");
    }
    if (!existing.has("otp_hash")) {
      missing.push("ADD COLUMN otp_hash VARCHAR(255) NULL");
    }
    if (!existing.has("otp_expires_at")) {
      missing.push("ADD COLUMN otp_expires_at DATETIME NULL");
    }
    if (!existing.has("verified_pincode")) {
      missing.push("ADD COLUMN verified_pincode VARCHAR(10) NULL");
    }
    if (!existing.has("verified_state")) {
      missing.push("ADD COLUMN verified_state VARCHAR(120) NULL");
    }
    if (!existing.has("verified_district")) {
      missing.push("ADD COLUMN verified_district VARCHAR(120) NULL");
    }
    if (!existing.has("verified_postoffice")) {
      missing.push("ADD COLUMN verified_postoffice VARCHAR(120) NULL");
    }
    if (!existing.has("address_verified")) {
      missing.push("ADD COLUMN address_verified TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!existing.has("verified_at")) {
      missing.push("ADD COLUMN verified_at DATETIME NULL");
    }

    if (!missing.length) {
      console.log("✅ residents verification columns ready");
      return;
    }

    db.query(`ALTER TABLE residents ${missing.join(", ")}`, (alterErr) => {
      if (alterErr) {
        console.error(
          "❌ residents verification column init failed:",
          alterErr.message
        );
        return;
      }

      console.log("✅ residents verification columns added");
    });
  });
}

const SPECIAL_PICKUP_FEES = {
  "Bulky Items": 50,
  "E-Waste": 30,
  "Garden Waste": 20,
};

function getSpecialPickupAmount(wasteType, quantity = 1) {
  const normalizedType = String(wasteType || "").trim();
  const qty = Number(quantity) || 1;

  const baseAmount = Object.prototype.hasOwnProperty.call(
    SPECIAL_PICKUP_FEES,
    normalizedType
  )
    ? SPECIAL_PICKUP_FEES[normalizedType]
    : 0;

  return baseAmount * qty;
}

function assignedDriverNameSql(vehicleAlias = "v") {
  return `COALESCE(
    (
      SELECT s.name
      FROM staff s
      WHERE UPPER(TRIM(COALESCE(s.truck_id, ''))) = UPPER(TRIM(${vehicleAlias}.vehicle_number))
        AND LOWER(COALESCE(s.role, '')) LIKE '%driver%'
        AND LOWER(COALESCE(s.status, '')) = 'active'
      ORDER BY s.id DESC
      LIMIT 1
    ),
    (
      SELECT s.name
      FROM staff s
      WHERE UPPER(TRIM(COALESCE(s.truck_id, ''))) = UPPER(TRIM(${vehicleAlias}.vehicle_number))
        AND LOWER(COALESCE(s.status, '')) = 'active'
      ORDER BY
        CASE WHEN LOWER(COALESCE(s.role, '')) LIKE '%driver%' THEN 0 ELSE 1 END,
        s.id DESC
      LIMIT 1
    ),
    (
      SELECT s.name
      FROM staff s
      WHERE UPPER(TRIM(COALESCE(s.truck_id, ''))) = UPPER(TRIM(${vehicleAlias}.vehicle_number))
      ORDER BY
        CASE WHEN LOWER(COALESCE(s.role, '')) LIKE '%driver%' THEN 0 ELSE 1 END,
        CASE WHEN LOWER(COALESCE(s.status, '')) = 'active' THEN 0 ELSE 1 END,
        s.id DESC
      LIMIT 1
    ),
    ${vehicleAlias}.driver_name
  )`;
}

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
    return;
  }
  console.log("✅ Connected to MySQL Database (ecotrack)");

  db.query(
    "SELECT DATABASE() AS db, @@port AS port, @@hostname AS host",
    (e, r) => {
      if (!e) console.log("DB CHECK:", r);
    }
  );

  db.query("SHOW COLUMNS FROM collections", (e, r) => {
    if (!e) console.log("COLUMNS collections:", r.map((x) => x.Field));
  });

  ensurePickupRequestTrackingColumns();
  ensureResidentVerificationColumns();

  db.query("SET time_zone = '+05:30'", (tzErr) => {
    if (tzErr) console.error("❌ Failed to set timezone:", tzErr.message);
    else console.log("✅ MySQL timezone set to +05:30");
  });
autoMarkPastAttendance();

setInterval(() => {
  autoMarkPastAttendance();
}, 60 * 60 * 1000);

ensureDailyHistoryForPastDays();

setInterval(() => {
  ensureDailyHistoryForPastDays();
}, 60 * 60 * 1000);

}); // ✅ CLOSE db.connect

function ensureDailyHistoryForPastDays() {
  const today = new Date();
  const todayStr = formatLocalDate(today);

  const residentsSql = `
    SELECT r.user_id, r.area
    FROM residents r
    WHERE r.user_id IS NOT NULL
      AND r.area IS NOT NULL
      AND TRIM(r.area) <> ''
  `;

  db.query(residentsSql, async (err, residents) => {
    if (err) {
      console.error("❌ Failed to load residents for daily history:", err.message);
      return;
    }

    if (!residents || !residents.length) {
      console.log("ℹ️ No residents found for daily history sync");
      return;
    }

    for (const resident of residents) {
      try {
        const userId = resident.user_id;
        const areaRaw = String(resident.area || "").trim();
        if (!userId || !areaRaw) continue;

        const attendanceSql = `
          SELECT attendance_date, status
          FROM attendance
          WHERE user_id = ?
            AND attendance_date < ?
          ORDER BY attendance_date ASC
        `;

        const [rows] = await db.promise().query(attendanceSql, [userId, todayStr]);

        for (const row of rows) {
          const dateStr = row.attendance_date;
          const attendanceStatus = String(row.status || "").toLowerCase();

          const start_time = await getPickupTimeFromDB(areaRaw);
          if (!start_time) continue;

          const end_time = addMinutesToTimeHHMMSS(
            start_time,
            PICKUP_DURATION_MINUTES
          );

          const collectionStatus = attendanceStatus === "no" ? "missed" : "completed";

          const insertSql = `
            INSERT INTO collections (user_id, title, type, due_date, start_time, end_time, status)
            SELECT ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1
              FROM collections
              WHERE user_id = ?
                AND due_date = ?
                AND type = ?
            )
          `;

          await db.promise().query(insertSql, [
            userId,
            `Garbage Pickup - ${areaRaw}`,
            "Mixed Waste",
            dateStr,
            start_time,
            end_time,
            collectionStatus,
            userId,
            dateStr,
            "Mixed Waste",
          ]);

          const updateSql = `
            UPDATE collections
            SET status = ?
            WHERE user_id = ?
              AND due_date = ?
              AND type = ?
          `;

          await db.promise().query(updateSql, [
            collectionStatus,
            userId,
            dateStr,
            "Mixed Waste",
          ]);
        }
      } catch (e) {
        console.error("❌ Daily history sync error:", e.message);
      }
    }

    console.log("✅ Daily history synced for all past attendance dates");
  });
}
// =======================
// ✅ SOCKET CONNECTION
// =======================
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  socket.on("joinRoom", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

/* =======================
   ✅ OTP ROUTES (optional)
======================= */
try {
  const addressOtpRoutes = require("./routes/addressOtp.js")(db);
  app.use("/api", addressOtpRoutes);
} catch (e) {
  console.log("ℹ️ addressOtp.js not found (skipping OTP routes).");
}

/* =======================
   ✅ HELPERS (DISTANCE/ETA)
======================= */
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function moveTowards(lat1, lng1, lat2, lng2, step = 0.00025) {
  const dLat = Number(lat2) - Number(lat1);
  const dLng = Number(lng2) - Number(lng1);
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  if (dist === 0 || dist <= step) {
    return { lat: Number(lat2), lng: Number(lng2), reached: true };
  }

  const ratio = step / dist;

  return {
    lat: Number(lat1) + dLat * ratio,
    lng: Number(lng1) + dLng * ratio,
    reached: false,
  };
}

const activeTruckMovements = {};

function stopTruckMovement(truckId) {
  if (!truckId || !activeTruckMovements[truckId]) return;
  clearInterval(activeTruckMovements[truckId]);
  delete activeTruckMovements[truckId];
}

/* =======================
   ✅ ROLE HELPERS
======================= */
function normRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "resident" || r === "admin") return r;
  return "resident";
}
function getAdminCount() {
  return new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(*) AS c FROM users WHERE LOWER(role)='admin'",
      (err, rows) => {
        if (err) return reject(err);
        resolve(Number(rows?.[0]?.c || 0));
      }
    );
  });
}

/* =======================
   ✅ AREA PICKUP TIMES (GOA)
======================= */

const PICKUP_DURATION_MINUTES = 60;

function getPickupTimeFromDB(areaRaw) {
  return new Promise((resolve, reject) => {
    const sql = "SELECT pickup_time FROM area_schedule WHERE area = ? LIMIT 1";

    db.query(sql, [areaRaw], (err, rows) => {
      if (err) return reject(err);

      if (!rows.length) return resolve(null);

      resolve(rows[0].pickup_time);
    });
  });
}


function addMinutesToTimeHHMMSS(timeStr, minutesToAdd) {
  const [hh, mm, ss] = String(timeStr || "00:00:00")
    .split(":")
    .map(Number);
  const base = new Date();
  base.setHours(hh || 0, mm || 0, ss || 0, 0);
  base.setMinutes(base.getMinutes() + minutesToAdd);
  const H = String(base.getHours()).padStart(2, "0");
  const M = String(base.getMinutes()).padStart(2, "0");
  const S = String(base.getSeconds()).padStart(2, "0");
  return `${H}:${M}:${S}`;
}
function isoDateOnly(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}
function addDaysISO(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDateOnly(d);
}
function formatLocalDate(dateObj = new Date()) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =======================
   PICKUP HELPERS ✅
======================= */
function getResidentArea(userId) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT area FROM residents WHERE user_id=? LIMIT 1`;
    db.query(sql, [userId], (err, rows) => {
      if (err) return reject(err);
      if (!rows.length || !rows[0].area) return resolve(null);
      resolve(String(rows[0].area).trim());
    });
  });
}
async function sendVerificationEmail(to, otp) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Verify your email",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Email Verification</h2>
        <p>Your OTP for account verification is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
      </div>
    `,
  });
}
async function createPickupForUserOnDate(userId, areaRaw, due_date) {
  try {
    const start_time = await getPickupTimeFromDB(areaRaw);

    if (!start_time) {
      return {
        ok: false,
        reason: "No schedule found in DB",
        area: areaRaw,
      };
    }

    const end_time = addMinutesToTimeHHMMSS(
      start_time,
      PICKUP_DURATION_MINUTES
    );

    const insertSql = `
      INSERT INTO collections (user_id, title, type, due_date, start_time, end_time, status)
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM collections
        WHERE user_id = ?
          AND due_date = ?
          AND type = ?
      )
    `;

    return new Promise((resolve) => {
      db.query(
        insertSql,
        [
          userId,
          `Garbage Pickup - ${areaRaw}`,
          "Mixed Waste",
          due_date,
          start_time,
          end_time,
          "scheduled",
          userId,
          due_date,
          "Mixed Waste",
        ],
        (err, result) => {
          if (err) {
            return resolve({
              ok: false,
              reason: "DB error",
              err: err.message,
            });
          }

          const created = result && result.affectedRows > 0;

          resolve({
            ok: true,
            created,
            pickup: {
              userId,
              area: areaRaw,
              due_date,
              start_time,
              end_time,
              status: "scheduled",
            },
          });
        }
      );
    });
  } catch (err) {
    return {
      ok: false,
      reason: err.message,
      area: areaRaw,
    };
  }
}

async function getNextDailyPickupForUser(userId) {
  const findNextSql = `
    SELECT id, user_id, title, type,
           DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
           TIME_FORMAT(start_time, '%H:%i:%s') AS start_time,
           TIME_FORMAT(end_time, '%H:%i:%s') AS end_time,
           status
    FROM collections
    WHERE user_id = ?
      AND LOWER(status) IN ('scheduled','ongoing')
      AND due_date >= CURDATE()
    ORDER BY due_date ASC, start_time ASC
    LIMIT 1
  `;

  const [rows] = await db.promise().query(findNextSql, [userId]);
  if (rows.length) return rows[0];

  const areaRaw = await getResidentArea(userId);
  if (!areaRaw) return null;

  const todayISO = isoDateOnly(new Date());
const start_time = await getPickupTimeFromDB(areaRaw);
  if (!start_time) return null;

  const end_time = addMinutesToTimeHHMMSS(start_time, PICKUP_DURATION_MINUTES);

  const now = new Date();
  const nowStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const targetDate = nowStr <= end_time ? todayISO : addDaysISO(todayISO, 1);
  await createPickupForUserOnDate(userId, areaRaw, targetDate);

  const [freshRows] = await db.promise().query(findNextSql, [userId]);
  return freshRows.length ? freshRows[0] : null;
}

function combineLocalDateAndTime(dateStr, timeStr = "00:00:00") {
  if (!dateStr) return null;

  const [year, month, day] = String(dateStr)
    .split("-")
    .map((value) => Number(value));
  const [hours, minutes, seconds] = String(timeStr || "00:00:00")
    .split(":")
    .map((value) => Number(value));

  const dt = new Date(
    year || 0,
    Math.max((month || 1) - 1, 0),
    day || 1,
    hours || 0,
    minutes || 0,
    seconds || 0,
    0
  );

  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getDailyTrackerMetrics(pickup) {
  const statusNorm = String(pickup?.status || "").trim().toLowerCase();

  if (statusNorm === "completed" || statusNorm === "collected") {
    return { etaMin: 0, progress: 100 };
  }

  if (statusNorm === "missed" || statusNorm === "cancelled") {
    return { etaMin: null, progress: 100 };
  }

  const startAt = combineLocalDateAndTime(pickup?.due_date, pickup?.start_time);
  const endAt = combineLocalDateAndTime(
    pickup?.due_date,
    pickup?.end_time || pickup?.start_time
  );
  const now = new Date();

  if (!startAt || !endAt) {
    return { etaMin: null, progress: 10 };
  }

  if (pickup?.due_date && pickup.due_date > isoDateOnly(now)) {
    return { etaMin: null, progress: 5 };
  }

  if (now < startAt) {
    const diffMin = Math.max(Math.ceil((startAt.getTime() - now.getTime()) / 60000), 0);
    const progress = diffMin > 120 ? 5 : diffMin > 60 ? 10 : 20;
    return { etaMin: diffMin, progress };
  }

  if (now >= endAt) {
    return { etaMin: 0, progress: 95 };
  }

  const totalMs = Math.max(endAt.getTime() - startAt.getTime(), 60000);
  const elapsedMs = Math.max(now.getTime() - startAt.getTime(), 0);

  return {
    etaMin: 0,
    progress: clamp(Math.round((elapsedMs / totalMs) * 100), 20, 90),
  };
}

const TRACKER_CENTER = { lat: 15.3991, lng: 74.0124 };
const TRACKER_SERVICE_LEAD_MINUTES = 30;

function hashTrackerKey(value) {
  return String(value || "default")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

function trackerAnchor(key, offset = 0) {
  const hash = hashTrackerKey(key) + offset * 31;
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 0.018 + (hash % 12) * 0.0014;

  return {
    lat: TRACKER_CENTER.lat + Math.sin(angle) * radius,
    lng: TRACKER_CENTER.lng + Math.cos(angle) * radius,
  };
}

function minutesFromTime(timeStr) {
  const raw = String(timeStr || "").trim();
  const match = raw.match(/(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return 7 * 60;

  let hh = Number(match[1]);
  const mm = Number(match[2] || 0);
  const ss = Number(match[3] || 0);
  const meridiem = String(match[4] || "").toLowerCase();

  if (meridiem === "pm" && hh < 12) hh += 12;
  if (meridiem === "am" && hh === 12) hh = 0;

  return (hh || 0) * 60 + (mm || 0) + (ss || 0) / 60;
}

function getServerScheduledTruckPosition({
  key,
  startTime,
  endTime,
  pickupDate,
  destLat,
  destLng,
}) {
  const today = isoDateOnly(new Date());
  const serviceDate = pickupDate || today;
  const routeStart = trackerAnchor(key, 1);
  const fallbackEnd = trackerAnchor(key, 2);
  const routeEnd = {
    lat: Number.isFinite(Number(destLat)) ? Number(destLat) : fallbackEnd.lat,
    lng: Number.isFinite(Number(destLng)) ? Number(destLng) : fallbackEnd.lng,
  };

  if (serviceDate > today) {
    return { ...routeStart, speed: 0, status: "Scheduled", progress: 5 };
  }

  if (serviceDate < today) {
    return { ...routeEnd, speed: 0, status: "Completed", progress: 100 };
  }

  const now = new Date();
  const currentMin =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const startMin = minutesFromTime(startTime);
  const endMin = Math.max(minutesFromTime(endTime || startTime), startMin + 60);
  const visibleStartMin = startMin - TRACKER_SERVICE_LEAD_MINUTES;
  const routeTotal = Math.max(endMin - visibleStartMin, 1);
  const progress = clamp((currentMin - visibleStartMin) / routeTotal, 0, 1);
  const lat = routeStart.lat + (routeEnd.lat - routeStart.lat) * progress;
  const lng = routeStart.lng + (routeEnd.lng - routeStart.lng) * progress;

  if (currentMin < visibleStartMin) {
    return { ...routeStart, speed: 0, status: "Scheduled", progress: 0 };
  }

  if (currentMin >= endMin) {
    return { ...routeEnd, speed: 0, status: "Arrived", progress: 100 };
  }

  return {
    lat,
    lng,
    speed: 18,
    status: "Active",
    progress: Math.round(progress * 100),
  };
}

function applyScheduledPosition(truck, schedule = {}) {
  if (!truck) return truck;

  const scheduled = getServerScheduledTruckPosition({
    key:
      schedule.key ||
      truck.truck_id ||
      truck.vehicle_number ||
      truck.zone ||
      truck.area_assigned,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    pickupDate: schedule.pickupDate,
    destLat: schedule.destLat,
    destLng: schedule.destLng,
  });

  return {
    ...truck,
    lat: scheduled.lat,
    lng: scheduled.lng,
    speed: scheduled.speed,
    status:
      String(truck.status || "").toLowerCase() === "maintenance"
        ? truck.status
        : scheduled.status,
    schedule_progress: scheduled.progress,
  };
}

function createNotification(
  userId,
  title,
  message,
  type = "general",
  extra = {}
) {
  return new Promise((resolve) => {
    db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES (?,?,?,?)",
      [userId, title, message, type],
      (err, result) => {
        if (err) {
          console.log("NOTIFICATION INSERT ERROR:", err.message);
          return resolve({ ok: false, error: err.message });
        }

        io.to(`user_${userId}`).emit("notification", {
          title,
          message,
          type,
          notificationId: result?.insertId || null,
          ...extra,
        });

        resolve({ ok: true, id: result?.insertId || null });
      }
    );
  });
}

/* ==========================================================
   ✅ ATTENDANCE + DAILY HISTORY HELPERS
========================================================== */
function ensureTodayAttendanceAndCollection(userId, cb) {
  const todayStr = formatLocalDate(new Date());

const attendanceSql = `
  INSERT INTO attendance (user_id, attendance_date, status)
  VALUES (?, ?, 'yes')
  ON DUPLICATE KEY UPDATE
    user_id = user_id
`;

  db.query(attendanceSql, [userId, todayStr], (err1) => {
    if (err1) return cb(err1);

    db.query(
      `SELECT area FROM residents WHERE user_id = ? LIMIT 1`,
      [userId],
      (err2, rows) => {
        if (err2) return cb(err2);

        const areaRaw = rows?.[0]?.area;
        if (!areaRaw) {
          return cb(null, {
            ok: true,
            attendanceEnsured: true,
            collectionEnsured: false,
            reason: "Resident area missing",
          });
        }

        createPickupForUserOnDate(userId, areaRaw, todayStr)
          .then(() => {
            const updateSql = `
              UPDATE collections
              SET status = CASE
                WHEN LOWER(COALESCE(status, '')) = 'missed' THEN 'missed'
                ELSE 'scheduled'
              END
              WHERE user_id = ? AND due_date = ?
            `;

            db.query(updateSql, [userId, todayStr], (err3, result3) => {
              if (err3) return cb(err3);

              return cb(null, {
                ok: true,
                attendanceEnsured: true,
                collectionEnsured: true,
                updated: result3?.affectedRows || 0,
              });
            });
          })
          .catch((e) => cb(e));
      }
    );
  });
}

function autoMarkPastAttendance() {
  const today = new Date();

  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  const todayStr = `${yyyy}-${mm}-${dd}`;

  const sql = `
    UPDATE attendance
    SET status = 'yes'
    WHERE attendance_date < ?
      AND (status IS NULL OR status = '')
  `;

  db.query(sql, [todayStr], (err, result) => {
    if (err) {
      console.error("❌ Auto past attendance error:", err.message);
    } else {
      console.log(
        `✅ Auto-marked ALL past attendance as collected (${result.affectedRows})`
      );
    }
  });
}

function ensurePasswordResetColumns() {
  db.query("SHOW COLUMNS FROM users", (err, rows) => {
    if (err) {
      console.error("❌ users schema read failed:", err.message);
      return;
    }

    const existing = new Set((rows || []).map((row) => row.Field));
    const missing = [];

    if (!existing.has("reset_token")) {
      missing.push("ADD COLUMN reset_token VARCHAR(255) NULL");
    }

    if (!existing.has("reset_token_expiry")) {
      missing.push("ADD COLUMN reset_token_expiry DATETIME NULL");
    }

    if (!missing.length) {
      console.log("✅ users password reset columns ready");
      return;
    }

    db.query(`ALTER TABLE users ${missing.join(", ")}`, (alterErr) => {
      if (alterErr) {
        console.error(
          "❌ users password reset column init failed:",
          alterErr.message
        );
        return;
      }

      console.log("✅ users password reset columns added");
    });
  });
}
/* =======================
   ✅ TEST ROUTE
======================= */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "EcoTrack Backend Running ✅" });
});

/* ==========================================================
   ✅ SIGNUP
========================================================== */


app.post("/signup", async (req, res) => {
  const {
    full_name,
    email,
    username,
    phone,
    city,
    state,
    area,
    house_no,
    password,
    role,
    adminKey,
  } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[6-9]\d{9}$/;

  if (
    !full_name ||
    !email ||
    !phone ||
    !city ||
    !state ||
    !area ||
    !house_no ||
    !password
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();
  const trimmedFullName = full_name.trim();
  const trimmedUsername = username ? username.trim() : null;
  const trimmedCity = city.trim();
  const trimmedState = state.trim();
  const trimmedArea = area.trim();
  const trimmedHouseNo = house_no.trim();

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (!phoneRegex.test(trimmedPhone)) {
    return res.status(400).json({
      message: "Invalid phone number (10 digits required)",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must be at least 6 characters",
    });
  }

  const roleNorm = normRole(role);

  try {
    if (roleNorm === "admin") {
      const adminCount = await getAdminCount();

      if (adminCount >= 1) {
        return res.status(403).json({ message: "Only one admin allowed" });
      }

      if (process.env.ADMIN_SIGNUP_KEY) {
        if (!adminKey || adminKey !== process.env.ADMIN_SIGNUP_KEY) {
          return res.status(403).json({ message: "Invalid admin key" });
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const checkUserQuery = `
      SELECT id, is_verified, role
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    db.query(checkUserQuery, [normalizedEmail], (checkErr, checkRows) => {
      if (checkErr) {
        console.error("CHECK USER ERROR:", checkErr);
        return res.status(500).json({ message: "Email check failed" });
      }

      if (checkRows.length > 0) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const insertUserQuery = `
        INSERT INTO users
        (full_name, username, email, password, role, is_verified, email_otp, email_otp_expiry)
        VALUES (?, ?, ?, ?, ?, 1, NULL, NULL)
      `;

      db.query(
        insertUserQuery,
        [
          trimmedFullName,
          trimmedUsername,
          normalizedEmail,
          hashedPassword,
          roleNorm,
        ],
        (insertErr, result) => {
          if (insertErr) {
            console.error("INSERT USER ERROR:", insertErr);

            if (insertErr.code === "ER_DUP_ENTRY") {
              return res.status(400).json({ message: "Email already exists" });
            }

            return res.status(500).json({ message: "User creation failed" });
          }

          const userId = result.insertId;

          if (roleNorm === "resident") {
            const insertResidentQuery = `
              INSERT INTO residents (user_id, phone, city, state, area, house_no)
              VALUES (?, ?, ?, ?, ?, ?)
            `;

            db.query(
              insertResidentQuery,
              [
                userId,
                trimmedPhone,
                trimmedCity,
                trimmedState,
                trimmedArea,
                trimmedHouseNo,
              ],
              (residentErr) => {
                if (residentErr) {
                  console.error("INSERT RESIDENT ERROR:", residentErr);
                  return res.status(500).json({
                    message: "Resident details failed",
                  });
                }

                return res.status(201).json({
                  message: "Signup successful ✅",
                  email: normalizedEmail,
                  userId,
                });
              }
            );
          } else {
            return res.status(201).json({
              message: "Admin signup successful ✅",
              email: normalizedEmail,
              userId,
            });
          }
        }
      );
    });
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});
/* ==========================================================
   ✅ LOGIN
========================================================== */
app.post("/login", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const roleNorm = String(role || "").trim().toLowerCase();

  if (!roleNorm) {
    return res.status(400).json({ message: "Role is required (resident/admin)" });
  }

  // ADMIN LOGIN
  if (roleNorm === "admin") {
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPass = String(process.env.ADMIN_PASSWORD || "").trim();

    if (!adminEmail || !adminPass) {
      return res.status(500).json({ message: "Admin credentials missing in .env" });
    }

    if (normalizedEmail !== adminEmail || password !== adminPass) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    return res.json({
      message: "Admin login successful ✅",
      user: {
        id: 0,
        email: adminEmail,
        full_name: "Admin",
        role: "admin",
        photo: null,
      },
    });
  }

  // RESIDENT LOGIN
  const query = "SELECT * FROM users WHERE email = ? LIMIT 1";

  db.query(query, [normalizedEmail], async (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = results[0];
    const dbRole = String(user.role || "").trim().toLowerCase();

    if (dbRole === "admin") {
      return res.status(403).json({ message: "Use Admin role to login." });
    }

    try {
      const ok = await bcrypt.compare(password, user.password);

      if (!ok) {
        return res.status(401).json({ message: "Incorrect password" });
      }

      return res.json({
        message: "Login successful ✅",
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: "resident",
          photo: user.photo,
        },
      });
    } catch (bcryptErr) {
      console.error("LOGIN BCRYPT ERROR:", bcryptErr);
      return res.status(500).json({ message: "Login failed" });
    }
  });
});
/* =======================
   ✅ PROFILE (GET/UPDATE)
======================= */
app.get("/api/profile/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.role,
         u.photo,
         COALESCE(r.phone, '') AS phone,
         COALESCE(r.city, '') AS city,
         COALESCE(r.area, '') AS area,
         COALESCE(r.house_no, '') AS house_no,
         COALESCE(r.address_verified, 0) AS address_verified
       FROM users u
       LEFT JOIN residents r ON r.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.put("/api/profile/:id", upload.single("photo"), async (req, res) => {
  const { id } = req.params;
  const fullName = String(req.body.full_name || "").trim();
  const email = String(req.body.email || "").trim();
  const phone = String(req.body.phone || "").trim();
  const city = String(req.body.city || "").trim();
  const area = String(req.body.area || "").trim();
  const houseNo = String(req.body.house_no || "").trim();
  const photo = req.file ? req.file.filename : null;

  if (!fullName || !email) {
    return res
      .status(400)
      .json({ message: "Full name and email are required." });
  }

  try {
    const userSql = photo
      ? "UPDATE users SET full_name=?, email=?, photo=? WHERE id=?"
      : "UPDATE users SET full_name=?, email=? WHERE id=?";
    const userValues = photo
      ? [fullName, email, photo, id]
      : [fullName, email, id];

    const [userResult] = await db.promise().query(userSql, userValues);

    if (!userResult.affectedRows) {
      return res.status(404).json({ message: "User not found" });
    }

    const [residentRows] = await db
      .promise()
      .query("SELECT id FROM residents WHERE user_id=? LIMIT 1", [id]);

    if (residentRows.length) {
      await db
        .promise()
        .query(
          "UPDATE residents SET phone=?, city=?, area=?, house_no=? WHERE user_id=?",
          [phone || null, city || null, area || null, houseNo || null, id]
        );
    } else {
      await db
        .promise()
        .query(
          "INSERT INTO residents (user_id, phone, city, area, house_no) VALUES (?, ?, ?, ?, ?)",
          [id, phone || null, city || null, area || null, houseNo || null]
        );
    }

    const [rows] = await db.promise().query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.role,
         u.photo,
         COALESCE(r.phone, '') AS phone,
         COALESCE(r.city, '') AS city,
         COALESCE(r.area, '') AS area,
         COALESCE(r.house_no, '') AS house_no,
         COALESCE(r.address_verified, 0) AS address_verified
       FROM users u
       LEFT JOIN residents r ON r.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    return res.json({
      message: "Profile updated successfully ✅",
      profile: rows[0],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/* ==========================================================
   ✅ RESIDENT REPORT ISSUE -> complaints
========================================================== */
app.post("/api/complaints", upload.single("photo"), (req, res) => {
  const { userId, citizen_name, location, issue_type, description, priority } =
    req.body;

  if (!userId || !location || !issue_type || !description) {
    return res.status(400).json({
      message: "userId, location, issue_type, description required",
    });
  }

  const p = String(priority || "medium").toLowerCase();
  const safePriority = ["low", "medium", "high"].includes(p) ? p : "medium";

  const sql = `
    INSERT INTO complaints (user_id, citizen_name, location, issue_type, description, status, priority)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `;

  db.query(
    sql,
    [
      userId,
      citizen_name || null,
      location,
      issue_type,
      description,
      safePriority,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({
        ok: true,
        message: "Complaint submitted ✅",
        id: result.insertId,
      });
    }
  );
});

/* ==========================================================
   ✅ ADMIN COMPLAINTS APIs
========================================================== */
app.get("/api/admin/complaints", (req, res) => {
  db.query(
    `SELECT id, citizen_name, location, issue_type, description, status, priority, created_at
     FROM complaints
     ORDER BY id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    }
  );
});

app.put("/api/admin/complaints/:id/status", (req, res) => {
  const { id } = req.params;
  const status = String(req.body.status || "").toLowerCase();

  if (!["pending", "in_progress", "resolved"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  db.query(
    "SELECT user_id, issue_type, location FROM complaints WHERE id=? LIMIT 1",
    [id],
    async (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!rows.length)
        return res.status(404).json({ message: "Complaint not found" });

      const userId = rows[0].user_id;
      const issueType = rows[0].issue_type || "Issue";
      const location = rows[0].location || "";

      db.query(
        "UPDATE complaints SET status=? WHERE id=?",
        [status, id],
        async (err2) => {
          if (err2) return res.status(500).json({ message: err2.message });

          if (userId) {
            const title = "Issue Status Updated";
            const msg =
              status === "in_progress"
                ? `Your issue (${issueType}) at ${location} is now In Progress.`
                : status === "resolved"
                ? `Your issue (${issueType}) at ${location} has been Resolved ✅`
                : `Your issue (${issueType}) at ${location} is now Pending.`;

            await createNotification(userId, title, msg, "complaint", {
              complaintId: Number(id),
              status,
            });

            return res.json({
              ok: true,
              message: "Status updated ✅ + notification sent",
            });
          } else {
            return res.json({
              ok: true,
              message: "Status updated ✅ (but no user_id to notify)",
            });
          }
        }
      );
    }
  );
});

/* ==========================================================
   ✅ NOTIFICATIONS (Resident)
========================================================== */
app.get("/api/notifications", (req, res) => {
  const userId = Number(req.query.userId);
  const uid = Number.isFinite(userId) && userId > 0 ? userId : 0;

  db.query(
    `SELECT id, user_id, title, message, type, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY id DESC`,
    [uid],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    }
  );
});

app.put("/api/notifications/:id/read", (req, res) => {
  const { id } = req.params;
  db.query(
    "UPDATE notifications SET is_read=1 WHERE id=?",
    [id],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ ok: true, affected: result.affectedRows });
    }
  );
});

app.get("/api/notifications/unread-count", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ message: "userId required" });

  db.query(
    "SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ unread: Number(rows?.[0]?.c || 0) });
    }
  );
});

app.put("/api/notifications/mark-all-read", (req, res) => {
  const userId = Number(req.body.userId);
  if (!userId) return res.status(400).json({ message: "userId required" });

  db.query(
    "UPDATE notifications SET is_read=1 WHERE user_id=?",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ ok: true, affected: result.affectedRows });
    }
  );
});

app.delete("/api/notifications/clear-all", (req, res) => {
  const userId = Number(req.query.userId || req.body?.userId);
  if (!userId) return res.status(400).json({ message: "userId required" });

  db.query(
    "DELETE FROM notifications WHERE user_id=?",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ ok: true, affected: result.affectedRows });
    }
  );
});

/* ==========================================================
   ✅ ADMIN DASHBOARD APIs
========================================================== */
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const [vehicles] = await db.promise().query(`
      SELECT
        COUNT(*) AS total,
        SUM(LOWER(status)='active') AS active,
        SUM(LOWER(status)='maintenance') AS maintenance,
        SUM(LOWER(status)='inactive') AS inactive
      FROM vehicles
    `);

    const [staff] = await db.promise().query(`
      SELECT
        COUNT(*) AS total,
        SUM(LOWER(status)='active') AS active,
        SUM(LOWER(status)='off duty') AS off_duty,
        SUM(LOWER(status)='on leave') AS on_leave
      FROM staff
    `);

    const [pickups] = await db.promise().query(`
      SELECT COUNT(*) AS total
      FROM pickup_requests
    `);

    const [issues] = await db.promise().query(`
      SELECT COUNT(*) AS total
      FROM complaints
    `);

    res.json({
      vehicles: vehicles[0],
      staff: staff[0],
      schedules: pickups[0],
      issues: issues[0],
    });
  } catch (err) {
    console.error("Dashboard summary failed:", err);
    res.status(500).json({ error: "Dashboard summary failed" });
  }
});

app.get("/api/dashboard/recent", (req, res) => {
  const out = {};

  db.query(
    `SELECT 
        v.id,
        v.vehicle_number,
        ${assignedDriverNameSql("v")} AS driver_name,
        v.area_assigned,
       0 AS speed,
        v.status
     FROM vehicles v
     ORDER BY v.id DESC
     LIMIT 6`,
    (err, v) => {
      if (err) return res.status(500).json({ message: err.message });
      out.vehicles = v;

      db.query(
        `SELECT id, name, role, status, zone, truck_id
         FROM staff
         ORDER BY id DESC
         LIMIT 6`,
        (err2, s) => {
          if (err2) return res.status(500).json({ message: err2.message });
          out.staff = s;

          db.query(
            `SELECT id, zone_name, collection_type, pickup_days, start_time, end_time, truck_id
             FROM schedules
             ORDER BY id DESC
             LIMIT 6`,
            (err3, sch) => {
              if (err3) return res.status(500).json({ message: err3.message });
              out.schedules = sch;

              db.query(
                `SELECT 
                    id,
                    issue_type AS title,
                    location,
                    status,
                    priority,
                    created_at
                 FROM complaints
                 ORDER BY id DESC
                 LIMIT 6`,
                (err4, c) => {
                  out.issues = err4 ? [] : c;
                  return res.json(out);
                }
              );
            }
          );
        }
      );
    }
  );
});

/* ==========================================================
   ✅ FLEET MONITOR
========================================================== */
app.get("/api/dashboard/fleet-monitor", (req, res) => {
  const sqlVehicles = `
    SELECT 
      COUNT(*) AS total,
      SUM(LOWER(status)='active') AS active,
      SUM(LOWER(status)='maintenance') AS maintenance,
      SUM(LOWER(status)='inactive') AS inactive,
      0 AS avg_speed
    FROM vehicles
  `;

  const sqlActive = `
    SELECT 
      v.id,
      v.vehicle_number,
      ${assignedDriverNameSql("v")} AS driver_name,
      v.area_assigned,
      v.status,
      v.lat,
      v.lng,
     0 AS speed
    FROM vehicles v
    ORDER BY v.id DESC
    LIMIT 10
  `;

  db.query(sqlVehicles, (err, vRows) => {
    if (err) return res.status(500).json({ message: err.message });

    db.query(sqlActive, (err2, listRows) => {
      if (err2) return res.status(500).json({ message: err2.message });

      return res.json({
        stats: vRows?.[0] || {},
        trucks: listRows || [],
      });
    });
  });
});

/* ==========================================================
   ✅ REPORTED ISSUES aliases
========================================================== */
app.get("/issues", (req, res) => {
  db.query(
    `SELECT id, citizen_name, location, issue_type, description, status, priority, created_at
     FROM complaints
     ORDER BY id DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    }
  );
});

app.get("/complaints", (req, res) => {
  db.query("SELECT * FROM complaints ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows || []);
  });
});

/* =======================
   ✅ LIVE TRACKING
======================= */
app.get("/live-tracking", async (req, res) => {
  const q = `
    SELECT
      v.id,
      v.vehicle_number AS truck_id,
      ${assignedDriverNameSql("v")} AS driver_name,
      v.area_assigned AS zone,
      TIME_FORMAT(a.pickup_time, '%H:%i:%s') AS pickup_time,
      v.lat,
      v.lng,
      0 AS speed,
      v.status
    FROM vehicles v
    LEFT JOIN area_schedule a
      ON UPPER(TRIM(COALESCE(a.truck_id, ''))) = UPPER(TRIM(v.vehicle_number))
      OR UPPER(TRIM(COALESCE(a.area, ''))) = UPPER(TRIM(COALESCE(v.area_assigned, '')))
    ORDER BY v.id ASC
  `;

  try {
    const [rows] = await db.promise().query(q);
    res.json(
      (rows || []).map((r) => {
        const baseTruck = {
          id: r.id,
          truck_id: r.truck_id,
          driver_name: r.driver_name,
          zone: r.zone,
          lat: r.lat === null ? null : Number(r.lat),
          lng: r.lng === null ? null : Number(r.lng),
          speed: Number(r.speed || 0),
          status: r.status,
        };
        const fallbackPoint = trackerAnchor(r.truck_id || r.zone, 0);
        const positioned = r.pickup_time
          ? applyScheduledPosition(baseTruck, {
              key: r.truck_id || r.zone,
              startTime: r.pickup_time,
              pickupDate: isoDateOnly(new Date()),
            })
          : {
              ...baseTruck,
              lat: Number.isFinite(baseTruck.lat)
                ? baseTruck.lat
                : fallbackPoint.lat,
              lng: Number.isFinite(baseTruck.lng)
                ? baseTruck.lng
                : fallbackPoint.lng,
            };

        return {
          ...positioned,
          pickup_time: r.pickup_time || null,
          lastUpdated: new Date().toISOString(),
        };
      })
    );
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

app.post("/driver/update", (req, res) => {
  const { truck_id, lat, lng, speed } = req.body;
  if (!truck_id || lat == null || lng == null) {
    return res
      .status(400)
      .json({ ok: false, message: "truck_id, lat, lng required" });
  }

 const q = `UPDATE vehicles SET lat=?, lng=? WHERE vehicle_number=?`;
db.query(
  q,
  [Number(lat), Number(lng), String(truck_id)],
    (err, result) => {
      if (err) return res.status(500).json({ ok: false, message: err.message });
      if (result.affectedRows === 0)
        return res.status(404).json({ ok: false, message: "No vehicle found." });
      res.json({ ok: true, message: "Location updated ✅" });
    }
  );
});

/* =======================
   ✅ STAFF APIs
======================= */

// GET all staff
app.get("/staff", (req, res) => {
  const sql = `
    SELECT 
      id,
      name,
      role,
      phone,
      email,
      area,
      zone,
      truck_id,
      status
    FROM staff
    ORDER BY id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("GET /staff error:", err);
      return res.status(500).json({ message: err.message });
    }
    res.json(rows || []);
  });
});

// ADD new staff
app.post("/staff", (req, res) => {
  const {
    name,
    role,
    status,
    area,
    zone,
    phone,
    email,
    truck_id,
  } = req.body;

  if (!name || !role) {
    return res.status(400).json({ message: "name and role are required" });
  }

  const finalArea = area || zone || null;
  const finalZone = zone || area || null;
  const finalStatus = status || "Active";

  const sql = `
    INSERT INTO staff (name, role, status, area, zone, phone, email, truck_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      name,
      role,
      finalStatus,
      finalArea,
      finalZone,
      phone || null,
      email || null,
      truck_id || null,
    ],
    (err, result) => {
      if (err) {
        console.error("POST /staff error:", err);
        return res.status(500).json({ message: err.message });
      }

      res.json({
        ok: true,
        id: result.insertId,
        message: "Staff added successfully ✅",
      });
    }
  );
});

// UPDATE full staff details
app.put("/staff/:id", (req, res) => {
  const { id } = req.params;
  const {
    name,
    role,
    status,
    area,
    zone,
    phone,
    email,
    truck_id,
  } = req.body;

  if (!name || !role) {
    return res.status(400).json({ message: "name and role are required" });
  }

  const finalArea = area || zone || null;
  const finalZone = zone || area || null;
  const finalStatus = status || "Active";

  const sql = `
    UPDATE staff
    SET name=?, role=?, status=?, area=?, zone=?, phone=?, email=?, truck_id=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      name,
      role,
      finalStatus,
      finalArea,
      finalZone,
      phone || null,
      email || null,
      truck_id || null,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("PUT /staff/:id error:", err);
        return res.status(500).json({ message: err.message });
      }

      res.json({
        ok: true,
        affected: result.affectedRows,
        message: "Staff updated successfully ✅",
      });
    }
  );
});

// UPDATE only staff status
app.put("/staff/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["Active", "Off Duty", "On Leave"];

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  const sql = "UPDATE staff SET status = ? WHERE id = ?";

  db.query(sql, [status, id], (err, result) => {
    if (err) {
      console.error("Update status error:", err);
      return res.status(500).json({ error: "Failed to update status" });
    }

    res.json({
      ok: true,
      message: "Status updated successfully ✅",
      affected: result.affectedRows,
    });
  });
});

// DELETE staff
app.delete("/staff/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM staff WHERE id=?", [id], (err, result) => {
    if (err) {
      console.error("DELETE /staff/:id error:", err);
      return res.status(500).json({ message: err.message });
    }

    res.json({
      ok: true,
      affected: result.affectedRows,
      message: "Staff deleted successfully ✅",
    });
  });
});

/* =======================
   ✅ SCHEDULES APIs
======================= */
app.get("/schedules", (req, res) => {
  db.query("SELECT * FROM schedules ORDER BY id DESC", (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows || []);
  });
});

app.post("/schedules", (req, res) => {
  const {
    zone_name,
    collection_type,
    pickup_days,
    start_time,
    end_time,
    truck_id,
    staff_assigned,
  } = req.body;

  if (!zone_name || !collection_type || !pickup_days || !start_time || !end_time) {
    return res.status(400).json({
      message:
        "zone_name, collection_type, pickup_days, start_time, end_time required",
    });
  }

  const q = `
    INSERT INTO schedules (zone_name, collection_type, pickup_days, start_time, end_time, truck_id, staff_assigned)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    q,
    [
      zone_name,
      collection_type,
      pickup_days,
      start_time,
      end_time,
      truck_id || null,
      staff_assigned || null,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ ok: true, id: result.insertId });
    }
  );
});

app.put("/schedules/:id", (req, res) => {
  const { id } = req.params;
  const {
    zone_name,
    collection_type,
    pickup_days,
    start_time,
    end_time,
    truck_id,
    staff_assigned,
  } = req.body;

  if (!zone_name || !collection_type || !pickup_days || !start_time || !end_time) {
    return res.status(400).json({
      message:
        "zone_name, collection_type, pickup_days, start_time, end_time required",
    });
  }

  const q = `
    UPDATE schedules
    SET zone_name=?, collection_type=?, pickup_days=?, start_time=?, end_time=?, truck_id=?, staff_assigned=?
    WHERE id=?
  `;

  db.query(
    q,
    [
      zone_name,
      collection_type,
      pickup_days,
      start_time,
      end_time,
      truck_id || null,
      staff_assigned || null,
      id,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ ok: true, affected: result.affectedRows });
    }
  );
});

app.delete("/schedules/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM schedules WHERE id=?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ ok: true, affected: result.affectedRows });
  });
});

/* =======================
   ✅ VEHICLES
======================= */
app.get("/api/vehicles", (req, res) => {
  db.query(
    `SELECT
       v.id,
       v.vehicle_number,
       ${assignedDriverNameSql("v")} AS driver_name,
       v.area_assigned,
       v.status,
       v.lat,
       v.lng,
       0 AS speed
     FROM vehicles v
     ORDER BY v.id ASC`,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows || []);
    }
  );
});

/* ==========================================================
   ✅ RESIDENT PICKUPS
========================================================== */
app.post("/api/pickups/generate-today", async (req, res) => {
  const userId = Number(req.body.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const areaRaw = await getResidentArea(userId);
    if (!areaRaw)
      return res.status(400).json({ message: "Resident area missing" });

    const due_date = isoDateOnly(new Date());
    const out = await createPickupForUserOnDate(userId, areaRaw, due_date);

    if (!out.ok)
      return res.status(400).json({ message: out.reason, area: out.area });

    return res.json({
      message: out.created
        ? "Pickup created ✅"
        : "Pickup already exists for today ✅",
      due_date,
      ...out.pickup,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server error" });
  }
});

function generateTodayPickupsForAll(cb) {
  const due_date = isoDateOnly(new Date());

  const sqlResidents = `
    SELECT user_id, area
    FROM residents
    WHERE area IS NOT NULL AND TRIM(area) <> ''
  `;

  db.query(sqlResidents, (err, residents) => {
    if (err) return cb && cb(err);

    if (!residents.length) {
      return (
        cb &&
        cb(null, {
          message: "No residents with area found",
          due_date,
          created: 0,
          skipped: 0,
          failed: 0,
        })
      );
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;

    const tasks = residents.map((r) => {
      return new Promise((resolve) => {
        const areaRaw = String(r.area || "").trim();

        getPickupTimeFromDB(areaRaw)
          .then((start_time) => {
            if (!start_time) {
              failed++;
              return resolve();
            }

            const end_time = addMinutesToTimeHHMMSS(
              start_time,
              PICKUP_DURATION_MINUTES
            );

            const insertSql = `
              INSERT INTO collections (user_id, title, type, due_date, start_time, end_time, status)
              SELECT ?, ?, ?, ?, ?, ?, ?
              WHERE NOT EXISTS (
                SELECT 1
                FROM collections
                WHERE user_id = ?
                  AND due_date = ?
                  AND type = ?
              )
            `;

            db.query(
              insertSql,
              [
                r.user_id,
                `Garbage Pickup - ${areaRaw}`,
                "Mixed Waste",
                due_date,
                start_time,
                end_time,
                "scheduled",
                r.user_id,
                due_date,
                "Mixed Waste",
              ],
              (inErr, result) => {
                if (inErr) {
                  failed++;
                  return resolve();
                }

                if (result && result.affectedRows > 0) created++;
                else skipped++;

                resolve();
              }
            );
          })
          .catch((err) => {
            console.error("Error getting pickup time from DB:", err.message);
            failed++;
            resolve();
          });
      });
    });

    Promise.all(tasks).then(() => {
      cb &&
        cb(null, {
          message: "Done ✅",
          due_date,
          created,
          skipped,
          failed,
        });
    });
  });
}
        
app.put("/api/areas/:id", (req, res) => {
  const { id } = req.params;
  const { area, pickup_time, truck_id, driver_name, status } = req.body;

  if (!area || !pickup_time) {
    return res.status(400).json({
      message: "area and pickup_time are required",
    });
  }

  const cleanArea = String(area).trim();
  const cleanTime = String(pickup_time).trim();
  const end_time = addMinutesToTimeHHMMSS(cleanTime, PICKUP_DURATION_MINUTES);

  // 1. Update main area schedule
  const updateAreaSql = `
    UPDATE area_schedule
    SET area = ?, pickup_time = ?, truck_id = ?, driver_name = ?, status = ?
    WHERE id = ?
  `;

  db.query(
    updateAreaSql,
    [
      cleanArea,
      cleanTime,
      truck_id || null,
      driver_name || null,
      status || "Active",
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Update area error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      // 2. Update future scheduled pickups for this area
      const updateCollectionsSql = `
        UPDATE collections
        SET start_time = ?, end_time = ?
        WHERE LOWER(title) = LOWER(?)
          AND LOWER(status) = 'scheduled'
          AND due_date >= CURDATE()
      `;

      db.query(
        updateCollectionsSql,
        [cleanTime, end_time, `Garbage Pickup - ${cleanArea}`],
        (err2, result2) => {
          if (err2) {
            console.error("Collections update error:", err2);
            return res.status(500).json({
              message: "Area updated but pickup update failed",
            });
          }

          res.json({
            ok: true,
            message: "Area and future pickups updated successfully ✅",
            affected_area_rows: result.affectedRows,
            affected_pickup_rows: result2.affectedRows,
          });
        }
      );
    }
  );
});


app.all("/api/pickups/generate-today/all", (req, res) => {
  generateTodayPickupsForAll((err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });
    return res.json(result);
  });
});

app.get("/api/pickups/next", async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const nextPickup = await getNextDailyPickupForUser(userId);
    return res.json({ nextPickup });
  } catch (e) {
    console.error("NEXT PICKUP ERROR:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/tracking/live", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ message: "userId is required" });

  const pickupSql = `
    SELECT
      id,
      status,
      assigned_truck_id,
      pickup_lat,
      pickup_lng,
      preferred_time,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS pickup_date
    FROM pickup_requests
    WHERE user_id = ?
      AND pickup_lat IS NOT NULL
      AND pickup_lng IS NOT NULL
      AND (
        pickup_date >= CURDATE()
        OR LOWER(COALESCE(status, '')) IN (
          'scheduled',
          'assigned',
          'pending',
          'ongoing',
          'in_progress',
          'in progress'
        )
      )
    ORDER BY pickup_date ASC, id DESC
    LIMIT 1
  `;

  const truckSelect = `
    SELECT
      v.vehicle_number,
      ${assignedDriverNameSql("v")} AS driver_name,
      v.area_assigned,
      v.lat,
      v.lng,
      0 AS speed,
      v.status
    FROM vehicles v
  `;

  const withAssignedTruckSql = `
    ${truckSelect}
    WHERE v.vehicle_number = ?
    LIMIT 1
  `;

  const withAreaTruckSql = `
    ${truckSelect}
    WHERE UPPER(TRIM(COALESCE(v.area_assigned, ''))) = UPPER(TRIM(?))
    ORDER BY
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const withMappedAreaTruckSql = `
    ${truckSelect}
    INNER JOIN areas a
      ON UPPER(TRIM(COALESCE(a.truck_id, ''))) = UPPER(TRIM(v.vehicle_number))
    WHERE UPPER(TRIM(COALESCE(a.area_name, ''))) = UPPER(TRIM(?))
    ORDER BY
      CASE WHEN LOWER(COALESCE(a.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const fallbackTruckSql = `
    ${truckSelect}
    ORDER BY
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const pickFirst = async (sql, params = []) => {
    const [rows] = await db.promise().query(sql, params);
    return rows[0] || null;
  };

  const buildTrackingResponse = ({
    truck,
    assignedTruckId,
    pickupDate,
    preferredTime,
    pickupStatus,
    distanceKm,
    etaMinutes,
    progress,
    trackingMode,
  }) => {
    if (!truck) {
      return {
        tracking: {
          status: "Awaiting assignment",
          eta_minutes: etaMinutes ?? null,
          progress: progress ?? 0,
          route_vehicle: assignedTruckId || "--",
          pickup_date: pickupDate || null,
          preferred_time: preferredTime || null,
          pickup_status: pickupStatus || null,
          tracking_mode: trackingMode || "special",
          last_update: null,
        },
      };
    }

    return {
      tracking: {
        status:
          distanceKm != null && distanceKm <= 0.05
            ? "Arrived"
            : String(truck.status || pickupStatus || "active"),
        eta_minutes: etaMinutes,
        progress,
        route_vehicle: truck.vehicle_number || assignedTruckId || "--",
        driver_name: truck.driver_name || null,
        distance_km: distanceKm == null ? null : Number(distanceKm.toFixed(2)),
        pickup_date: pickupDate || null,
        preferred_time: preferredTime || null,
        pickup_status: pickupStatus || null,
        tracking_mode: trackingMode || "special",
        area: truck.area_assigned || null,
        last_update: new Date().toISOString(),
      },
    };
  };

  (async () => {
    try {
      const [pickupRows] = await db.promise().query(pickupSql, [userId]);
      const pickup = pickupRows[0] || null;

      if (pickup) {
        const assignedTruckId = pickup.assigned_truck_id
          ? String(pickup.assigned_truck_id)
          : null;

        let truck = null;
        if (assignedTruckId) {
          truck = await pickFirst(withAssignedTruckSql, [assignedTruckId]);
        }
        if (!truck) {
          truck = await pickFirst(fallbackTruckSql);
        }

        if (!truck) {
          return res.json(
            buildTrackingResponse({
              truck: null,
              assignedTruckId,
              pickupDate: pickup.pickup_date,
              preferredTime: pickup.preferred_time,
              pickupStatus: pickup.status,
              distanceKm: null,
              etaMinutes: null,
              progress: 0,
              trackingMode: "special",
            })
          );
        }

        const tLat = Number(truck.lat);
        const tLng = Number(truck.lng);
        const pLat = Number(pickup.pickup_lat);
        const pLng = Number(pickup.pickup_lng);

        const hasCoords =
          Number.isFinite(tLat) &&
          Number.isFinite(tLng) &&
          Number.isFinite(pLat) &&
          Number.isFinite(pLng);

        const distanceKm = hasCoords ? haversineKm(tLat, tLng, pLat, pLng) : null;
        const speed = Math.max(Number(truck.speed || 25), 1);
        const etaMinutes =
          distanceKm == null ? null : Math.max(0, Math.ceil((distanceKm / speed) * 60));
        const progress =
          distanceKm == null ? 0 : clamp(Math.round((1 - distanceKm / 5) * 100), 0, 100);

        return res.json(
          buildTrackingResponse({
            truck,
            assignedTruckId,
            pickupDate: pickup.pickup_date,
            preferredTime: pickup.preferred_time,
            pickupStatus: pickup.status,
            distanceKm,
            etaMinutes,
            progress,
            trackingMode: "special",
          })
        );
      }

      const nextDailyPickup = await getNextDailyPickupForUser(userId);
      if (!nextDailyPickup) return res.json({ tracking: null });

      const areaRaw = await getResidentArea(userId);
      let truck = null;
      if (areaRaw) {
        truck = await pickFirst(withAreaTruckSql, [areaRaw]);
        if (!truck) {
          truck = await pickFirst(withMappedAreaTruckSql, [areaRaw]);
        }
      }
      if (!truck) {
        truck = await pickFirst(fallbackTruckSql);
      }

      const { etaMin, progress } = getDailyTrackerMetrics(nextDailyPickup);

      return res.json(
        buildTrackingResponse({
          truck,
          assignedTruckId: truck?.vehicle_number || null,
          pickupDate: nextDailyPickup.due_date,
          preferredTime:
            [nextDailyPickup.start_time, nextDailyPickup.end_time]
              .filter(Boolean)
              .join(" - ") || nextDailyPickup.start_time,
          pickupStatus: nextDailyPickup.status,
          distanceKm: null,
          etaMinutes: etaMin,
          progress,
          trackingMode: "daily",
        })
      );
    } catch (err) {
      return res.status(500).json({ message: err.message || "Server error" });
    }
  })();
});

app.get("/resident/live", async (req, res) => {
  const userId = Number(req.query.userId);
  const fallbackTruckId = String(req.query.truckId || "ECO-001");

  if (!userId) {
    return res.status(400).json({
      ok: false,
      message: "userId is required",
    });
  }

  const pickupSql = `
    SELECT
      id,
      waste_type,
      pickup_address,
      pickup_lat,
      pickup_lng,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS pickup_date,
      preferred_time,
      assigned_truck_id,
      status
    FROM pickup_requests
    WHERE user_id = ?
      AND pickup_lat IS NOT NULL
      AND pickup_lng IS NOT NULL
      AND (
        pickup_date >= CURDATE()
        OR LOWER(COALESCE(status, '')) IN (
          'scheduled',
          'assigned',
          'pending',
          'ongoing',
          'in_progress',
          'in progress'
        )
      )
    ORDER BY pickup_date ASC, id DESC
    LIMIT 1
  `;

  const truckSelect = `
    SELECT
      v.id,
      v.vehicle_number AS truck_id,
      ${assignedDriverNameSql("v")} AS driver_name,
      v.area_assigned AS zone,
      v.lat,
      v.lng,
    0 AS speed,
      v.status
    FROM vehicles v
  `;

  const findTruckByIdSql = `
    ${truckSelect}
    WHERE v.vehicle_number = ?
    LIMIT 1
  `;

  const findTruckByAreaSql = `
    ${truckSelect}
    WHERE UPPER(TRIM(COALESCE(v.area_assigned, ''))) = UPPER(TRIM(?))
    ORDER BY
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const findTruckFromAreaMapSql = `
    ${truckSelect}
    INNER JOIN areas a
      ON UPPER(TRIM(COALESCE(a.truck_id, ''))) = UPPER(TRIM(v.vehicle_number))
    WHERE UPPER(TRIM(COALESCE(a.area_name, ''))) = UPPER(TRIM(?))
    ORDER BY
      CASE WHEN LOWER(COALESCE(a.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const findFallbackTruckSql = `
    ${truckSelect}
    ORDER BY
      CASE WHEN LOWER(COALESCE(v.status, 'active')) = 'active' THEN 0 ELSE 1 END,
      v.id ASC
    LIMIT 1
  `;

  const pickFirst = async (sql, params = []) => {
    const [rows] = await db.promise().query(sql, params);
    return rows[0] || null;
  };

  const findBestTruck = async (preferredTruckId, areaRaw) => {
    if (preferredTruckId) {
      const preferredTruck = await pickFirst(findTruckByIdSql, [preferredTruckId]);
      if (preferredTruck) return preferredTruck;
    }

    if (areaRaw) {
      const areaTruck = await pickFirst(findTruckByAreaSql, [areaRaw]);
      if (areaTruck) return areaTruck;

      const mappedTruck = await pickFirst(findTruckFromAreaMapSql, [areaRaw]);
      if (mappedTruck) return mappedTruck;
    }

    if (fallbackTruckId && String(preferredTruckId || "") !== fallbackTruckId) {
      const fallbackTruck = await pickFirst(findTruckByIdSql, [fallbackTruckId]);
      if (fallbackTruck) return fallbackTruck;
    }

    return pickFirst(findFallbackTruckSql);
  };

  const buildTruckPayload = (truck, distanceKm, speed) => {
    const tLat = Number(truck?.lat);
    const tLng = Number(truck?.lng);

    return {
      id: truck?.id || null,
      truck_id: truck?.truck_id || fallbackTruckId,
      driver_name: truck?.driver_name || null,
      zone: truck?.zone || null,
      lat: Number.isFinite(tLat) ? tLat : null,
      lng: Number.isFinite(tLng) ? tLng : null,
      speed,
      status:
        distanceKm != null && distanceKm <= 0.05
          ? "Arrived"
          : String(truck?.status || "active"),
    };
  };

  try {
    const [pickupRows] = await db.promise().query(pickupSql, [userId]);
    const specialPickup = pickupRows[0] || null;

    if (specialPickup) {
      const desiredTruckId = String(specialPickup.assigned_truck_id || fallbackTruckId);
      const baseTruck = await findBestTruck(desiredTruckId, null);

      if (!baseTruck) {
        return res.status(404).json({
          ok: false,
          message: "Truck not found",
          truckId: desiredTruckId,
        });
      }

      const truck = applyScheduledPosition(baseTruck, {
        key: desiredTruckId,
        startTime: specialPickup.preferred_time,
        pickupDate: specialPickup.pickup_date,
        destLat: specialPickup.pickup_lat,
        destLng: specialPickup.pickup_lng,
      });
      const tLat = Number(truck.lat);
      const tLng = Number(truck.lng);
      const pLat = Number(specialPickup.pickup_lat);
      const pLng = Number(specialPickup.pickup_lng);

      const hasCoords =
        Number.isFinite(tLat) &&
        Number.isFinite(tLng) &&
        Number.isFinite(pLat) &&
        Number.isFinite(pLng);

      const distanceKm = hasCoords ? haversineKm(tLat, tLng, pLat, pLng) : null;
      const speed = Number.isFinite(Number(truck.speed)) ? Number(truck.speed) : 25;
      const speedForEta = speed > 0 ? speed : 25;
      const etaMin =
        distanceKm == null ? null : Math.ceil((distanceKm / speedForEta) * 60);
      const progress =
        distanceKm == null ? 0 : clamp(Math.round((1 - distanceKm / 5) * 100), 0, 100);

      return res.json({
        ok: true,
        tracking_mode: "special",
        userId,
        truckId: truck.truck_id,
        home: {
          lat: pLat,
          lng: pLng,
          address: specialPickup.pickup_address || null,
          pickup_date: specialPickup.pickup_date || null,
          preferred_time: specialPickup.preferred_time || null,
          waste_type: specialPickup.waste_type || null,
          assigned_truck_id: specialPickup.assigned_truck_id || null,
          pickup_status: specialPickup.status || null,
        },
        truck: buildTruckPayload(truck, distanceKm, speed),
        distance_km: distanceKm == null ? null : Number(distanceKm.toFixed(2)),
        eta_min: etaMin,
        progress,
      });
    }

    const nextDailyPickup = await getNextDailyPickupForUser(userId);
    if (!nextDailyPickup) {
      return res.status(404).json({
        ok: false,
        message: "No scheduled pickup found for this resident.",
      });
    }

    const [residentRows] = await db.promise().query(
      `
        SELECT
          COALESCE(NULLIF(TRIM(house_no), ''), NULL) AS house_no,
          COALESCE(NULLIF(TRIM(area), ''), NULL) AS area,
          COALESCE(NULLIF(TRIM(city), ''), NULL) AS city
        FROM residents
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId]
    );

    const resident = residentRows[0] || {};
    const areaRaw = resident.area || (await getResidentArea(userId)) || null;
    const baseTruck = await findBestTruck(null, areaRaw);

    if (!baseTruck) {
      return res.status(404).json({
        ok: false,
        message: "Truck not found",
        truckId: fallbackTruckId,
      });
    }

    const truck = applyScheduledPosition(baseTruck, {
      key: areaRaw || baseTruck.truck_id,
      startTime: nextDailyPickup.start_time,
      endTime: nextDailyPickup.end_time,
      pickupDate: nextDailyPickup.due_date,
    });
    const speed = Number.isFinite(Number(truck.speed)) ? Number(truck.speed) : 18;
    const { etaMin, progress } = getDailyTrackerMetrics(nextDailyPickup);
    const addressParts = [resident.house_no, resident.area, resident.city].filter(Boolean);
    const addressLabel =
      addressParts.join(", ") ||
      areaRaw ||
      nextDailyPickup.title ||
      "Resident area pickup";
    const windowLabel = [nextDailyPickup.start_time, nextDailyPickup.end_time]
      .filter(Boolean)
      .join(" - ");

    return res.json({
      ok: true,
      tracking_mode: "daily",
      userId,
      truckId: truck.truck_id,
      home: {
        lat: null,
        lng: null,
        address: addressLabel,
        area: areaRaw,
        pickup_date: nextDailyPickup.due_date || null,
        preferred_time: nextDailyPickup.start_time || null,
        end_time: nextDailyPickup.end_time || null,
        window_label: windowLabel || null,
        waste_type: nextDailyPickup.type || "Mixed Waste",
        assigned_truck_id: truck.truck_id || null,
        pickup_status: nextDailyPickup.status || null,
        title: nextDailyPickup.title || null,
      },
      truck: buildTruckPayload(truck, null, speed),
      distance_km: null,
      eta_min: etaMin,
      progress,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err.message || "Server error",
    });
  }
});

app.get("/resident/stats", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) {
    return res.status(400).json({
      ok: false,
      message: "userId is required",
    });
  }

  const collectionsSql = `
    SELECT
      COUNT(*) AS total,
      SUM(LOWER(status)='completed') AS completed,
      SUM(LOWER(status)='missed') AS missed,
      SUM(LOWER(status)='scheduled') AS scheduled
    FROM collections
    WHERE user_id = ?
  `;

  const requestsSql = `
    SELECT
      COUNT(*) AS total,
      SUM(LOWER(status) IN ('completed','done')) AS completed,
      SUM(LOWER(status)='missed') AS missed,
      SUM(LOWER(status)='scheduled') AS scheduled
    FROM pickup_requests
    WHERE user_id = ?
  `;

  db.query(collectionsSql, [userId], (colErr, colRows) => {
    if (colErr) return res.status(500).json({ ok: false, message: colErr.message });

    db.query(requestsSql, [userId], (reqErr, reqRows) => {
      if (reqErr) return res.status(500).json({ ok: false, message: reqErr.message });

      const collections = colRows?.[0] || {};
      const requests = reqRows?.[0] || {};

      const collectionsTotal = Number(collections.total || 0);
      const requestsTotal = Number(requests.total || 0);
      const collectionsCompleted = Number(collections.completed || 0);
      const requestsCompleted = Number(requests.completed || 0);
      const collectionsMissed = Number(collections.missed || 0);
      const requestsMissed = Number(requests.missed || 0);
      const collectionsScheduled = Number(collections.scheduled || 0);
      const requestsScheduled = Number(requests.scheduled || 0);

      const totalPickups = collectionsTotal + requestsTotal;
      const completed = collectionsCompleted + requestsCompleted;
      const missed = collectionsMissed + requestsMissed;
      const scheduled = collectionsScheduled + requestsScheduled;
      const ecoScoreRaw =
        collectionsCompleted * 10 +
        requestsCompleted * 15 +
        scheduled * 2 -
        missed * 5;

      return res.json({
        ok: true,
        userId,
        totalPickups,
        ecoScore: Math.max(0, ecoScoreRaw),
        completed,
        missed,
        scheduled,
      });
    });
  });
});

/* =======================
   ✅ AUTO-MARK MISSED
======================= */
setInterval(() => {
  const sql = `
    UPDATE collections
    SET status = 'missed'
    WHERE LOWER(status) IN ('scheduled','ongoing')
      AND (
        due_date < CURDATE()
        OR (due_date = CURDATE() AND end_time IS NOT NULL AND end_time < CURTIME())
      )
  `;
  db.query(sql, (err, result) => {
    if (err) return console.error("AUTO MISS ERROR:", err.message);
    if (result.affectedRows > 0)
      console.log(`⚠️ Auto-marked missed: ${result.affectedRows}`);
  });
}, 60 * 1000);

/* =======================
   ✅ AUTO GENERATE DAILY PICKUPS AT 12:05 AM
======================= */
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 5) {
    console.log("🕛 Running daily pickup generation...");
    generateTodayPickupsForAll((err, out) => {
      if (err) console.log("❌ Daily generation failed");
      else console.log("✅ Daily generation result:", out);
    });
  }
}, 60 * 1000);

/* ==========================================================
   ✅ ATTENDANCE APIs
========================================================== */
app.post("/api/attendance/ensure-today", (req, res) => {
  const userId = Number(req.body.userId);

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  ensureTodayAttendanceAndCollection(userId, (err, result) => {
    if (err) {
      console.error("ENSURE TODAY ERROR:", err);
      return res
        .status(500)
        .json({ message: "Server error while ensuring today" });
    }

    return res.json({
      ok: true,
      message: "Today's attendance and daily history ensured ✅",
      result,
    });
  });
});

app.get("/api/attendance", (req, res) => {
  const { userId, year, month } = req.query;

  if (!userId || !year || !month) {
    return res.status(400).json({ message: "Missing userId/year/month" });
  }

  const uid = Number(userId);
  const m = Number(month);
  const y = Number(year);

  if (
    !Number.isFinite(uid) ||
    !Number.isFinite(m) ||
    m < 1 ||
    m > 12 ||
    !Number.isFinite(y)
  ) {
    return res.status(400).json({ message: "Invalid userId/year/month" });
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const loadAttendanceRows = () => {
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const sql = `
      SELECT 
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date,
        status
      FROM attendance
      WHERE user_id = ?
        AND attendance_date >= ?
        AND attendance_date < ?
      ORDER BY attendance_date ASC
    `;

    db.query(sql, [uid, start, end], (err, rows) => {
      if (err) {
        console.log("ATTENDANCE GET ERROR:", err);
        return res
          .status(500)
          .json({ message: "Server error while loading attendance" });
      }

      return res.json({ attendance: rows || [] });
    });
  };

  if (y === currentYear && m === currentMonth) {
    ensureTodayAttendanceAndCollection(uid, (err) => {
      if (err) {
        console.log("ENSURE TODAY IN GET ERROR:", err);
      }
      loadAttendanceRows();
    });
  } else {
    loadAttendanceRows();
  }
});

app.post("/api/attendance/mark", (req, res) => {
  const { userId, date, status } = req.body;

  if (!userId || !date) {
    return res
      .status(400)
      .json({ message: "Missing fields (userId, date)" });
  }

  const todayStr = formatLocalDate(new Date());

  if (date !== todayStr) {
    return res
      .status(400)
      .json({ message: "Only today's attendance can be changed." });
  }

  // Undo missed -> clear today's manual mark
 if (status === "" || status === null) {
  const clearSql = `
    UPDATE attendance
    SET status = NULL
    WHERE user_id = ? AND attendance_date = ?
  `;

  db.query(clearSql, [userId, date], (err, result) => {
    if (err) {
      console.error("Undo attendance error:", err);
      return res.status(500).json({ message: "Failed to undo missed status" });
    }

    db.query(
      `
      UPDATE collections
      SET status = 'completed'
      WHERE user_id = ? AND due_date = ?
      `,
      [userId, date],
      (err2) => {
        if (err2) {
          console.error("Collection undo sync error:", err2);
          return res.status(500).json({
            message: "Missed removed, but failed to update history status",
          });
        }

        return res.json({
          ok: true,
          message: "Missed status removed. History updated to Collected ✅",
          affectedRows: result.affectedRows,
        });
      }
    );
  });

  return;
}

  if (!["yes", "no"].includes(String(status).toLowerCase())) {
    return res
      .status(400)
      .json({ message: "Invalid status. Use yes, no, or empty for undo." });
  }

  const finalStatus = String(status).toLowerCase();

  const sql = `
    INSERT INTO attendance (user_id, attendance_date, status)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      status = VALUES(status)
  `;

  db.query(sql, [userId, date, finalStatus], (err, result) => {
    if (err) {
      console.error("Attendance mark error:", err);
      return res.status(500).json({ message: "Failed to save attendance" });
    }

    // Optional: sync collections table for same day
    const collectionStatus =
      finalStatus === "no" ? "missed" : "completed";

    db.query(
      `
      UPDATE collections
      SET status = ?
      WHERE user_id = ? AND due_date = ?
      `,
      [collectionStatus, userId, date],
      (err2) => {
        if (err2) {
          console.error("Collection sync error:", err2);
        }

        return res.json({
          ok: true,
          message:
            finalStatus === "no"
              ? "Attendance marked as missed ✅"
              : "Attendance updated successfully ✅",
          affectedRows: result.affectedRows,
        });
      }
    );
  });
});

/* ==========================================================
   ✅ RECENT HISTORY
========================================================== */
app.get("/api/history/recent", (req, res) => {
  const userId = Number(req.query.userId);
  const limit = Math.min(Number(req.query.limit || 5), 20);

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const dailySql = `
    SELECT
      MAX(id) AS id,
      user_id,
      'daily' AS history_kind,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS date,
      TIME_FORMAT(MAX(start_time), '%H:%i:%s') AS time,
      type,
      CASE
        WHEN SUM(CASE WHEN LOWER(status) = 'missed' THEN 1 ELSE 0 END) > 0 THEN 'Missed'
        WHEN SUM(CASE WHEN LOWER(status) IN ('completed', 'collected') THEN 1 ELSE 0 END) > 0 THEN 'Collected'
        ELSE 'Pending'
      END AS status,
      NULL AS weight,
      NULL AS address,
      NULL AS notes,
      NULL AS amount
    FROM collections
    WHERE user_id = ?
      AND LOWER(status) IN ('completed', 'missed', 'collected')
    GROUP BY user_id, due_date, type
  `;

  const scheduledSql = `
    SELECT
      id,
      user_id,
      'scheduled' AS history_kind,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS date,
      preferred_time AS time,
      waste_type AS type,
      status,
      NULL AS weight,
      pickup_address AS address,
      instructions AS notes,
      amount
    FROM pickup_requests
    WHERE user_id = ?
      AND LOWER(status) IN ('scheduled', 'assigned', 'in_progress', 'completed', 'cancelled')
  `;

  db.query(dailySql, [userId], (err1, dailyRows) => {
    if (err1) {
      console.error("Recent daily history error:", err1);
      return res.status(500).json({ message: "Daily history query failed" });
    }

    db.query(scheduledSql, [userId], (err2, scheduledRows) => {
      if (err2) {
        console.error("Recent scheduled history error:", err2);
        return res
          .status(500)
          .json({ message: "Scheduled history query failed" });
      }

      const history = [...(dailyRows || []), ...(scheduledRows || [])]
        .sort((a, b) => {
          const da = new Date(`${a.date}T${a.time || "00:00:00"}`);
          const dbb = new Date(`${b.date}T${b.time || "00:00:00"}`);
          return dbb - da;
        })
        .slice(0, limit);

      return res.json({ history });
    });
  });
});

/* ==========================================================
   ✅ FULL HISTORY
========================================================== */
app.get("/api/history/all", (req, res) => {
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const dailySql = `
    SELECT
      MAX(id) AS id,
      user_id,
      'daily' AS history_kind,
      DATE_FORMAT(due_date, '%Y-%m-%d') AS date,
      TIME_FORMAT(MAX(start_time), '%H:%i:%s') AS time,
      type,
      CASE
        WHEN SUM(CASE WHEN LOWER(status) = 'missed' THEN 1 ELSE 0 END) > 0 THEN 'Missed'
        WHEN SUM(CASE WHEN LOWER(status) IN ('completed', 'collected') THEN 1 ELSE 0 END) > 0 THEN 'Collected'
        ELSE 'Pending'
      END AS status,
      NULL AS weight,
      NULL AS address,
      NULL AS notes,
      NULL AS amount
    FROM collections
    WHERE user_id = ?
      AND LOWER(status) IN ('completed', 'missed', 'collected')
    GROUP BY user_id, due_date, type
  `;

  const scheduledSql = `
    SELECT
      id,
      user_id,
      'scheduled' AS history_kind,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS date,
      preferred_time AS time,
      waste_type AS type,
      status,
      NULL AS weight,
      pickup_address AS address,
      instructions AS notes,
      amount
    FROM pickup_requests
    WHERE user_id = ?
      AND LOWER(status) IN ('scheduled', 'assigned', 'in_progress', 'completed', 'cancelled')
  `;

  db.query(dailySql, [userId], (err1, dailyRows) => {
    if (err1) {
      console.error("Full daily history error:", err1);
      return res.status(500).json({ message: "Daily history query failed" });
    }

    db.query(scheduledSql, [userId], (err2, scheduledRows) => {
      if (err2) {
        console.error("Full scheduled history error:", err2);
        return res
          .status(500)
          .json({ message: "Scheduled history query failed" });
      }

      const history = [...(dailyRows || []), ...(scheduledRows || [])].sort(
        (a, b) => {
          const da = new Date(`${a.date}T${a.time || "00:00:00"}`);
          const dbb = new Date(`${b.date}T${b.time || "00:00:00"}`);
          return dbb - da;
        }
      );

      return res.json({ history });
    });
  });
});

/* ==========================================================
   ✅ SPECIAL PICKUP APIs
========================================================== */
app.post("/api/pickups", async (req, res) => {
  const {
    userId,
    wasteType,
    bulkyItem,
    pickupDate,
    preferredTime,
    pickupAddress,
    pickupLat,
    pickupLng,
    instructions,
    paymentMethod,
    paymentStatus,
    paymentReference,
    residentUpiId,
    municipalityUpiId,
  } = req.body;

  if (!userId || !wasteType || !pickupDate || !preferredTime || !pickupAddress) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  const safeAmount = Number(req.body.amount) || 0;
  const safeGst = Number(req.body.gst) || Math.round(safeAmount * 0.18);
  const safeTotal = Number(req.body.total) || safeAmount + safeGst;

  if (safeAmount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const methodValue = String(paymentMethod || "").toLowerCase();

  const safePaymentMethod =
    methodValue === "razorpay"
      ? "razorpay"
      : methodValue === "upi"
      ? "upi"
      : "cash";

  if (safePaymentMethod === "upi") {
    if (!residentUpiId || !String(residentUpiId).trim()) {
      return res.status(400).json({ message: "Resident UPI ID is required" });
    }

    if (!paymentReference || !String(paymentReference).trim()) {
      return res
        .status(400)
        .json({ message: "UTR / Transaction ID is required" });
    }
  }

  const safePickupLat =
    pickupLat === "" || pickupLat === null || pickupLat === undefined
      ? null
      : Number.isFinite(Number(pickupLat))
      ? Number(pickupLat)
      : null;

  const safePickupLng =
    pickupLng === "" || pickupLng === null || pickupLng === undefined
      ? null
      : Number.isFinite(Number(pickupLng))
      ? Number(pickupLng)
      : null;

  const safePaymentStatus =
    paymentStatus ||
    (safePaymentMethod === "razorpay"
      ? "paid"
      : safePaymentMethod === "upi"
      ? "verification_pending"
      : "pending_cash");

  const sql = `
    INSERT INTO pickup_requests
      (
        user_id,
        waste_type,
        bulky_item,
        pickup_date,
        preferred_time,
        pickup_address,
        pickup_lat,
        pickup_lng,
        instructions,
        amount,
        gst,
        total,
        payment_method,
        payment_status,
        payment_reference,
        resident_upi_id,
        municipality_upi_id,
        status
      )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      userId,
      wasteType,
      bulkyItem || null,
      pickupDate,
      preferredTime,
      pickupAddress,
      safePickupLat,
      safePickupLng,
      instructions || null,
      safeAmount,
      safeGst,
      safeTotal,
      safePaymentMethod,
      safePaymentStatus,
      paymentReference || null,
      residentUpiId || null,
      municipalityUpiId || null,
      "scheduled",
    ],
    async (err, result) => {
      if (err) {
        console.log("PICKUP SAVE ERROR:", err);
        return res.status(500).json({
          message: "DB error",
          error: err.message,
        });
      }

      const pickupId = result.insertId;

      let title = "Pickup Scheduled";
      let msg = `Your ${wasteType} pickup has been scheduled for ${pickupDate} at ${preferredTime}.`;

      if (safePaymentMethod === "razorpay") {
        title = "Payment Successful";
        msg = `Your ${wasteType} pickup has been scheduled for ${pickupDate} at ${preferredTime}. Payment of ₹${safeTotal} was completed successfully.`;
      } else if (safePaymentMethod === "upi") {
        title = "Payment Submitted";
        msg = `Your ${wasteType} pickup has been scheduled for ${pickupDate} at ${preferredTime}. UPI payment is submitted for verification.`;
      } else {
        title = "Cash Pickup Confirmed";
        msg = `Your ${wasteType} pickup has been scheduled for ${pickupDate} at ${preferredTime}. Cash payment of ₹${safeTotal} will be collected during pickup.`;
      }

      await createNotification(userId, title, msg, "pickup", {
        pickupId,
        status: "scheduled",
        paymentMethod: safePaymentMethod,
        paymentStatus: safePaymentStatus,
        amount: safeAmount,
        gst: safeGst,
        total: safeTotal,
      });

      return res.json({
        ok: true,
        message: "✅ Pickup scheduled successfully",
        id: pickupId,
        amount: safeAmount,
        gst: safeGst,
        total: safeTotal,
      });
    }
  );
});
// ✅ upcoming pickups for resident
app.get("/api/pickups/upcoming/:userId", (req, res) => {
  const userId = Number(req.params.userId);

  if (!userId) {
    return res.status(400).json({ message: "Invalid userId" });
  }

  const sql = `
    SELECT 
      id,
      waste_type,
      bulky_item,
      pickup_date,
      preferred_time,
      pickup_address,
      instructions,
      amount,
      gst,
      total,
      payment_method,
      payment_status,
      payment_reference,
      resident_upi_id,
      municipality_upi_id,
      status,
      created_at
    FROM pickup_requests
    WHERE user_id = ?
      AND pickup_date >= CURDATE()
    ORDER BY pickup_date ASC, id DESC
    LIMIT 10
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.log("UPCOMING PICKUPS ERROR:", err);
      return res.status(500).json({
        message: "DB error",
        error: err.message,
      });
    }

    return res.json(rows || []);
  });
});

/* ==========================================================
   ✅ ADMIN PICKUP REQUESTS APIs
========================================================== */
app.get("/api/admin/pickups", (req, res) => {
  const sql = `
    SELECT 
      pr.id,
      pr.user_id,
      u.full_name AS resident_name,
      pr.waste_type,
      pr.bulky_item,
      DATE_FORMAT(pr.pickup_date, '%Y-%m-%d') AS pickup_date,
      pr.preferred_time,
      pr.pickup_address,
      pr.pickup_lat,
      pr.pickup_lng,
      pr.instructions,
      pr.status,
      pr.assigned_to,
      s.name AS staff_name,
      pr.assigned_truck_id,
      pr.assigned_at,
      pr.created_at
    FROM pickup_requests pr
    LEFT JOIN users u ON pr.user_id = u.id
    LEFT JOIN staff s ON pr.assigned_to = s.id
    ORDER BY pr.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching admin pickups:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(result || []);
  });
});

app.post("/api/admin/pickups/:pickupId/assign-truck", (req, res) => {
  const { pickupId } = req.params;
  const { truck_id } = req.body;

  if (!truck_id) {
    return res.status(400).json({
      ok: false,
      message: "truck_id is required",
    });
  }

  const pickupSql = `
    SELECT
      id,
      user_id,
      waste_type,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS pickup_date,
      preferred_time,
      pickup_address,
      pickup_lat,
      pickup_lng,
      status,
      assigned_truck_id
    FROM pickup_requests
    WHERE id = ?
    LIMIT 1
  `;

  db.query(pickupSql, [pickupId], (pickupErr, pickupRows) => {
    if (pickupErr) {
      return res.status(500).json({ ok: false, message: pickupErr.message });
    }

    if (!pickupRows.length) {
      return res.status(404).json({ ok: false, message: "Pickup not found" });
    }

    const pickup = pickupRows[0];
    const pickupStatus = String(pickup.status || "").toLowerCase();

    if (pickupStatus === "completed" || pickupStatus === "cancelled") {
      return res.status(400).json({
        ok: false,
        message: "Completed or cancelled pickups cannot be assigned to a truck",
      });
    }

    if (!pickup.pickup_lat || !pickup.pickup_lng) {
      return res.status(400).json({
        ok: false,
        message: "Pickup location missing",
      });
    }

    const truckSql = `
      SELECT
        v.id,
        v.vehicle_number,
        ${assignedDriverNameSql("v")} AS driver_name,
        v.lat,
        v.lng,
        0 AS speed
      FROM vehicles v
      WHERE v.vehicle_number = ?
      LIMIT 1
    `;

    db.query(truckSql, [truck_id], (truckErr, truckRows) => {
      if (truckErr) {
        return res.status(500).json({ ok: false, message: truckErr.message });
      }

      if (!truckRows.length) {
        return res.status(404).json({ ok: false, message: "Truck not found" });
      }

      const truck = truckRows[0];
      let currentLat = Number(truck.lat);
      let currentLng = Number(truck.lng);

      if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
        return res.status(400).json({
          ok: false,
          message: "Truck current coordinates missing",
        });
      }

      const assignSql = `
        UPDATE pickup_requests
        SET
          assigned_truck_id = ?,
          assigned_at = NOW(),
          status = CASE
            WHEN LOWER(status) = 'scheduled' THEN 'assigned'
            ELSE status
          END
        WHERE id = ?
      `;

      db.query(assignSql, [truck_id, pickupId], async (assignErr) => {
        if (assignErr) {
          return res.status(500).json({ ok: false, message: assignErr.message });
        }

        if (
          pickup.assigned_truck_id &&
          String(pickup.assigned_truck_id) !== String(truck_id)
        ) {
          stopTruckMovement(String(pickup.assigned_truck_id));
        }
        stopTruckMovement(truck_id);

        const destLat = Number(pickup.pickup_lat);
        const destLng = Number(pickup.pickup_lng);

        try {
          await createNotification(
            pickup.user_id,
            "Truck Assigned",
            `Truck ${truck_id} has been assigned for your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time}.`,
            "pickup",
            {
              pickupId: Number(pickupId),
              truckId: truck_id,
            }
          );
        } catch (e) {
          console.error("Truck assignment notification failed:", e);
        }

        activeTruckMovements[truck_id] = setInterval(() => {
          const next = moveTowards(currentLat, currentLng, destLat, destLng, 0.00025);
          currentLat = next.lat;
          currentLng = next.lng;

          const remainingKm = haversineKm(currentLat, currentLng, destLat, destLng);
          const currentSpeed = next.reached ? 0 : Number(truck.speed || 30);
          const vehicleStatus = next.reached ? "Arrived" : "Active";

          db.query(
            `
              UPDATE vehicles
              SET lat = ?, lng = ?, speed = ?, status = ?
              WHERE vehicle_number = ?
            `,
            [currentLat, currentLng, currentSpeed, vehicleStatus, truck_id],
            (updateErr) => {
              if (updateErr) {
                console.error("Truck movement update error:", updateErr.message);
              }
            }
          );

          io.emit("truckMoved", {
            truck_id,
            lat: currentLat,
            lng: currentLng,
            status: vehicleStatus,
            remaining_km: Number(remainingKm.toFixed(2)),
          });

          if (next.reached) {
            stopTruckMovement(truck_id);

            db.query(
              `
                UPDATE pickup_requests
                SET status = 'completed'
                WHERE id = ?
              `,
              [pickupId],
              async (doneErr) => {
                if (doneErr) {
                  console.error("Pickup completion update error:", doneErr.message);
                  return;
                }

                try {
                  await createNotification(
                    pickup.user_id,
                    "Pickup Truck Arrived",
                    `Truck ${truck_id} has arrived for your ${pickup.waste_type} pickup scheduled on ${pickup.pickup_date}.`,
                    "pickup",
                    {
                      pickupId: Number(pickupId),
                      truckId: truck_id,
                      status: "completed",
                    }
                  );
                } catch (e) {
                  console.error("Truck arrival notification failed:", e);
                }
              }
            );
          }
        }, 2000);

        return res.json({
          ok: true,
          message: "Truck assigned and movement started ✅",
          pickupId: Number(pickupId),
          truck_id,
          driver_name: truck.driver_name || null,
        });
      });
    });
  });
});

app.put("/api/admin/pickups/:id/assign", (req, res) => {
  const { id } = req.params;
  const { assigned_to } = req.body;

  if (!assigned_to) {
    return res.status(400).json({ message: "assigned_to is required" });
  }

  const getPickupSql = `
    SELECT 
      pr.id,
      pr.user_id,
      pr.waste_type,
      DATE_FORMAT(pr.pickup_date, '%Y-%m-%d') AS pickup_date,
      pr.preferred_time,
      s.name AS staff_name
    FROM pickup_requests pr
    LEFT JOIN staff s ON s.id = ?
    WHERE pr.id = ?
    LIMIT 1
  `;

  db.query(getPickupSql, [assigned_to, id], async (fetchErr, rows) => {
    if (fetchErr) {
      console.error("Error fetching pickup before assign:", fetchErr);
      return res.status(500).json({ message: "Server error" });
    }

    if (!rows.length) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    const pickup = rows[0];

    const sql = `
      UPDATE pickup_requests
      SET assigned_to = ?, status = 'assigned'
      WHERE id = ?
    `;

    db.query(sql, [assigned_to, id], async (err, result) => {
      if (err) {
        console.error("Error assigning pickup:", err);
        return res.status(500).json({ message: "Server error" });
      }

      const title = "Pickup Assigned";
      const msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} has been assigned to ${pickup.staff_name || "staff"}.`;

      await createNotification(pickup.user_id, title, msg, "pickup", {
        pickupId: Number(id),
        status: "assigned",
      });

      res.json({
        ok: true,
        message: "Pickup assigned successfully ✅",
        affected: result.affectedRows,
      });
    });
  });
});

app.put("/api/admin/pickups/:id/status", (req, res) => {
  const { id } = req.params;
  const status = String(req.body.status || "").toLowerCase();

  const allowed = [
    "scheduled",
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
  ];

  if (!allowed.includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const getPickupSql = `
    SELECT
      id,
      user_id,
      assigned_truck_id,
      waste_type,
      DATE_FORMAT(pickup_date, '%Y-%m-%d') AS pickup_date,
      preferred_time
    FROM pickup_requests
    WHERE id = ?
    LIMIT 1
  `;

  db.query(getPickupSql, [id], async (fetchErr, rows) => {
    if (fetchErr) {
      console.error("Error fetching pickup before status update:", fetchErr);
      return res.status(500).json({ message: "Server error" });
    }

    if (!rows.length) {
      return res.status(404).json({ message: "Pickup not found" });
    }

    const pickup = rows[0];
    const sql = `UPDATE pickup_requests SET status = ? WHERE id = ?`;

    db.query(sql, [status, id], async (err, result) => {
      if (err) {
        console.error("Error updating pickup status:", err);
        return res.status(500).json({ message: "Server error" });
      }

      if (
        (status === "completed" || status === "cancelled") &&
        pickup.assigned_truck_id
      ) {
        stopTruckMovement(String(pickup.assigned_truck_id));
      }

      let title = "Pickup Status Updated";
      let msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} is now ${status}.`;

      if (status === "in_progress") {
        title = "Pickup In Progress";
        msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} is now in progress.`;
      } else if (status === "completed") {
        title = "Pickup Completed";
        msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} has been completed ✅`;
      } else if (status === "cancelled") {
        title = "Pickup Cancelled";
        msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} has been cancelled.`;
      } else if (status === "assigned") {
        title = "Pickup Assigned";
        msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} has been assigned.`;
      } else if (status === "scheduled") {
        title = "Pickup Scheduled";
        msg = `Your ${pickup.waste_type} pickup on ${pickup.pickup_date} at ${pickup.preferred_time} is scheduled.`;
      }

      await createNotification(pickup.user_id, title, msg, "pickup", {
        pickupId: Number(id),
        status,
      });

      res.json({
        ok: true,
        message: "Pickup status updated successfully ✅",
        affected: result.affectedRows,
      });
    });
  });
});

app.get("/api/admin/staff", (req, res) => {
  const sql = `
    SELECT id, name, role, zone, phone, email, status
    FROM staff
    ORDER BY name ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching staff:", err);
      return res.status(500).json({ message: "Server error" });
    }
    res.json(result || []);
  });
});

app.get("/api/complaints/user/:userId", (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      id,
      issue_type,
      location,
      description,
      priority,
      status,
      admin_remark,
      created_at
    FROM complaints
    WHERE user_id = ?
    ORDER BY created_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Fetch complaints error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

/* =======================
   ✅ VENDOR MANAGEMENT APIs
======================= */

// GET all vendors
app.get("/api/vendors", (req, res) => {
  const { area = "", status = "", search = "" } = req.query;

  let sql = `
    SELECT * FROM vendors
    WHERE 1=1
  `;
  const params = [];

  if (area) {
    sql += ` AND area = ?`;
    params.push(area);
  }

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (search) {
    sql += ` AND (
      vendor_name LIKE ?
      OR contact_person LIKE ?
      OR phone LIKE ?
      OR email LIKE ?
      OR waste_types LIKE ?
      OR area LIKE ?
    )`;
    const q = `%${search}%`;
    params.push(q, q, q, q, q, q);
  }

  sql += ` ORDER BY created_at DESC`;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("GET /api/vendors error:", err);
      return res.status(500).json({ error: "Failed to fetch vendors" });
    }
    res.json(results);
  });
});

// GET single vendor
app.get("/api/vendors/:id", (req, res) => {
  const { id } = req.params;

  db.query(`SELECT * FROM vendors WHERE id = ?`, [id], (err, results) => {
    if (err) {
      console.error("GET /api/vendors/:id error:", err);
      return res.status(500).json({ error: "Failed to fetch vendor" });
    }

    if (!results.length) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(results[0]);
  });
});

// ADD vendor
app.post("/api/vendors", (req, res) => {
  const {
    vendor_name,
    contact_person,
    phone,
    email,
    waste_types,
    area,
    address,
    status,
  } = req.body;

  if (!vendor_name || !waste_types) {
    return res.status(400).json({
      error: "vendor_name and waste_types are required",
    });
  }

  const sql = `
    INSERT INTO vendors
    (vendor_name, contact_person, phone, email, waste_types, area, address, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      vendor_name,
      contact_person || null,
      phone || null,
      email || null,
      waste_types,
      area || null,
      address || null,
      status || "Active",
    ],
    (err, result) => {
      if (err) {
        console.error("POST /api/vendors error:", err);
        return res.status(500).json({ error: "Failed to add vendor" });
      }

      res.json({
        message: "Vendor added successfully",
        vendorId: result.insertId,
      });
    }
  );
});

// UPDATE vendor
app.put("/api/vendors/:id", (req, res) => {
  const { id } = req.params;
  const {
    vendor_name,
    contact_person,
    phone,
    email,
    waste_types,
    area,
    address,
    status,
  } = req.body;

  if (!vendor_name || !waste_types) {
    return res.status(400).json({
      error: "vendor_name and waste_types are required",
    });
  }

  const sql = `
    UPDATE vendors
    SET vendor_name = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        waste_types = ?,
        area = ?,
        address = ?,
        status = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      vendor_name,
      contact_person || null,
      phone || null,
      email || null,
      waste_types,
      area || null,
      address || null,
      status || "Active",
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("PUT /api/vendors/:id error:", err);
        return res.status(500).json({ error: "Failed to update vendor" });
      }

      res.json({ message: "Vendor updated successfully" });
    }
  );
});

// DELETE vendor
app.delete("/api/vendors/:id", (req, res) => {
  const { id } = req.params;

  db.query(`DELETE FROM vendors WHERE id = ?`, [id], (err, result) => {
    if (err) {
      console.error("DELETE /api/vendors/:id error:", err);
      return res.status(500).json({ error: "Failed to delete vendor" });
    }

    res.json({ message: "Vendor deleted successfully" });
  });
});

/* =======================
   ✅ VENDOR PICKUP ASSIGNMENT APIs
======================= */

// Assign vendor to a pickup request
app.post("/api/vendor-assignments", (req, res) => {
  const { pickup_request_id, vendor_id, assigned_by, notes } = req.body;

  if (!pickup_request_id || !vendor_id) {
    return res.status(400).json({
      error: "pickup_request_id and vendor_id are required",
    });
  }

  const checkSql = `
    SELECT * FROM vendor_pickup_assignments
    WHERE pickup_request_id = ?
  `;

  db.query(checkSql, [pickup_request_id], (checkErr, checkResults) => {
    if (checkErr) {
      console.error("Vendor assignment check error:", checkErr);
      return res.status(500).json({ error: "Failed to check assignment" });
    }

    if (checkResults.length > 0) {
      return res.status(400).json({
        error: "This pickup request is already assigned to a vendor",
      });
    }

    const insertSql = `
      INSERT INTO vendor_pickup_assignments
      (pickup_request_id, vendor_id, assigned_by, notes, status)
      VALUES (?, ?, ?, ?, 'Assigned')
    `;

    db.query(
      insertSql,
      [pickup_request_id, vendor_id, assigned_by || null, notes || null],
      (err, result) => {
        if (err) {
          console.error("POST /api/vendor-assignments error:", err);
          return res.status(500).json({ error: "Failed to assign vendor" });
        }

        res.json({
          message: "Vendor assigned successfully",
          assignmentId: result.insertId,
        });
      }
    );
  });
});

// Get all vendor assignments
app.get("/api/vendor-assignments", (req, res) => {
  const sql = `
    SELECT
      vpa.id,
      vpa.pickup_request_id,
      vpa.vendor_id,
      vpa.assigned_by,
      vpa.assigned_at,
      vpa.status,
      vpa.notes,
      v.vendor_name,
      v.contact_person,
      v.phone,
      v.email,
      v.waste_types,
      v.area
    FROM vendor_pickup_assignments vpa
    JOIN vendors v ON vpa.vendor_id = v.id
    ORDER BY vpa.assigned_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("GET /api/vendor-assignments error:", err);
      return res.status(500).json({ error: "Failed to fetch vendor assignments" });
    }

    res.json(results);
  });
});

// Update vendor assignment status
app.put("/api/vendor-assignments/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["Assigned", "Accepted", "Completed", "Cancelled"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  db.query(
    `UPDATE vendor_pickup_assignments SET status = ? WHERE id = ?`,
    [status, id],
    (err, result) => {
      if (err) {
        console.error("PUT /api/vendor-assignments/:id/status error:", err);
        return res.status(500).json({ error: "Failed to update vendor assignment status" });
      }

      res.json({ message: "Vendor assignment status updated successfully" });
    }
  );
});

// Delete vendor assignment
app.delete("/api/vendor-assignments/:id", (req, res) => {
  const { id } = req.params;

  db.query(
    `DELETE FROM vendor_pickup_assignments WHERE id = ?`,
    [id],
    (err, result) => {
      if (err) {
        console.error("DELETE /api/vendor-assignments/:id error:", err);
        return res.status(500).json({ error: "Failed to delete vendor assignment" });
      }

      res.json({ message: "Vendor assignment deleted successfully" });
    }
  );
});

app.put("/api/pickups/assign-vendor/:pickupId", (req, res) => {
  const { pickupId } = req.params;
  const { vendor_id } = req.body;

  if (!vendor_id) {
    return res.status(400).json({ error: "Vendor ID required" });
  }

  const sql = `
    UPDATE pickup_requests
    SET vendor_id = ?, status = 'assigned'
    WHERE id = ?
  `;

  db.query(sql, [vendor_id, pickupId], (err, result) => {
    if (err) {
      console.error("Vendor assignment error:", err);
      return res.status(500).json({ error: "Failed to assign vendor" });
    }

    res.json({ message: "Vendor assigned successfully" });
  });
});

app.get("/api/areas", (req, res) => {
  const sql = `
    SELECT id, area, city, state, pickup_time, truck_id, driver_name, status
    FROM area_schedule
    ORDER BY area ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Fetch areas error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows || []);
  });
});
app.post("/api/areas", (req, res) => {
  const { area, city, state, pickup_time, truck_id, driver_name, status } = req.body;

  if (!area || !city || !state || !pickup_time) {
    return res.status(400).json({
      message: "area, city, state and pickup_time are required",
    });
  }

  const cleanArea = String(area).trim();
  const cleanCity = String(city).trim();
  const cleanState = String(state).trim();
  const cleanTime = String(pickup_time).trim();

  const checkSql = `SELECT id FROM area_schedule WHERE LOWER(area) = LOWER(?) LIMIT 1`;

  db.query(checkSql, [cleanArea], (checkErr, checkRows) => {
    if (checkErr) {
      console.error("Check area error:", checkErr);
      return res.status(500).json({ message: "Database error" });
    }

    if (checkRows.length) {
      return res.status(400).json({ message: "Area already exists" });
    }

    const insertSql = `
      INSERT INTO area_schedule (area, city, state, pickup_time, truck_id, driver_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertSql,
      [
        cleanArea,
        cleanCity,
        cleanState,
        cleanTime,
        truck_id || null,
        driver_name || null,
        status || "Active",
      ],
      (err, result) => {
        if (err) {
          console.error("Add area error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        res.json({
          ok: true,
          message: "Area added successfully ✅",
          id: result.insertId,
        });
      }
    );
  });
});

app.put("/api/areas/:id", (req, res) => {
  const { id } = req.params;
  const { area, city, state, pickup_time, truck_id, driver_name, status } = req.body;

  if (!area || !city || !state || !pickup_time) {
    return res.status(400).json({
      message: "area, city, state and pickup_time are required",
    });
  }

  const cleanArea = String(area).trim();
  const cleanCity = String(city).trim();
  const cleanState = String(state).trim();
  const cleanTime = String(pickup_time).trim();

  const updateAreaSql = `
    UPDATE area_schedule
    SET area = ?, city = ?, state = ?, pickup_time = ?, truck_id = ?, driver_name = ?, status = ?
    WHERE id = ?
  `;

  db.query(
    updateAreaSql,
    [
      cleanArea,
      cleanCity,
      cleanState,
      cleanTime,
      truck_id || null,
      driver_name || null,
      status || "Active",
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Update area error:", err);
        return res.status(500).json({ message: "Database error" });
      }

      const end_time = addMinutesToTimeHHMMSS(cleanTime, PICKUP_DURATION_MINUTES);

      const updateCollectionsSql = `
        UPDATE collections
        SET start_time = ?, end_time = ?
        WHERE LOWER(title) = LOWER(?)
          AND LOWER(status) = 'scheduled'
          AND due_date >= CURDATE()
      `;

      db.query(
        updateCollectionsSql,
        [cleanTime, end_time, `Garbage Pickup - ${cleanArea}`],
        (err2, result2) => {
          if (err2) {
            console.error("Collections update error:", err2);
          }

          res.json({
            ok: true,
            message: "Area + pickups updated successfully ✅",
            affected_area_rows: result.affectedRows,
            affected_pickup_rows: result2 ? result2.affectedRows : 0,
          });
        }
      );
    }
  );
});

app.delete("/api/areas/:id", (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM area_schedule WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error("Delete area error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({
      ok: true,
      message: "Area deleted successfully ✅",
      affected: result.affectedRows,
    });
  });
});


/* =======================
   ✅ RAZORPAY PAYMENT APIs
======================= */
app.post("/api/payments/create-order", async (req, res) => {
  try {
    const { amount, receipt, notes } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(Number(amount) * 100), // rupees -> paise
      currency: "INR",
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {},
    });

    return res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Razorpay create-order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
});

app.post("/api/payments/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment verification fields",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    return res.json({
      success: true,
      message: "Payment verified successfully",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error) {
    console.error("Razorpay verify error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
});

/* =========================
   VEHICLE MANAGEMENT APIs
========================= */

// Get all vehicles with log count
app.get("/api/vehicles", (req, res) => {
  const sql = `
    SELECT 
      v.*,
      (
        SELECT COUNT(*)
        FROM vehicle_logs vl
        WHERE vl.vehicle_id = v.id
      ) AS log_count
    FROM vehicles v
    ORDER BY v.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("GET /api/vehicles error:", err);
      return res.status(500).json({ error: "Failed to fetch vehicles" });
    }
    res.json(results);
  });
});

// Add vehicle + create log
app.post("/api/vehicles", (req, res) => {
  const {
    vehicle_number,
    driver_name,
    area_assigned,
    status,
    fuel_level,
    last_service_date,
    notes,
  } = req.body;

  if (!vehicle_number || !area_assigned) {
    return res.status(400).json({
      error: "vehicle_number and area_assigned are required",
    });
  }

  const sql = `
    INSERT INTO vehicles
    (vehicle_number, driver_name, area_assigned, status, fuel_level, last_service_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      vehicle_number,
      driver_name || null,
      area_assigned,
      status || "Active",
      fuel_level || 0,
      last_service_date || null,
      notes || null,
    ],
    (err, result) => {
      if (err) {
        console.error("POST /api/vehicles error:", err);
        return res.status(500).json({ error: "Failed to add vehicle" });
      }

      const vehicleId = result.insertId;

      db.query(
        `INSERT INTO vehicle_logs (vehicle_id, log_type, description) VALUES (?, ?, ?)`,
        [
          vehicleId,
          "Created",
          `Vehicle ${vehicle_number} created and assigned to ${area_assigned}`,
        ],
        (logErr) => {
          if (logErr) {
            console.error("Vehicle create log error:", logErr);
          }
        }
      );

      res.json({
        message: "Vehicle added successfully",
        vehicleId,
      });
    }
  );
});

// Update vehicle + create log
app.put("/api/vehicles/:id", (req, res) => {
  const { id } = req.params;
  const {
    vehicle_number,
    driver_name,
    area_assigned,
    status,
    fuel_level,
    last_service_date,
    notes,
  } = req.body;

  if (!vehicle_number || !area_assigned) {
    return res.status(400).json({
      error: "vehicle_number and area_assigned are required",
    });
  }

  const sql = `
    UPDATE vehicles
    SET vehicle_number = ?,
        driver_name = ?,
        area_assigned = ?,
        status = ?,
        fuel_level = ?,
        last_service_date = ?,
        notes = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      vehicle_number,
      driver_name || null,
      area_assigned,
      status || "Active",
      fuel_level || 0,
      last_service_date || null,
      notes || null,
      id,
    ],
    (err) => {
      if (err) {
        console.error("PUT /api/vehicles/:id error:", err);
        return res.status(500).json({ error: "Failed to update vehicle" });
      }

      db.query(
        `INSERT INTO vehicle_logs (vehicle_id, log_type, description) VALUES (?, ?, ?)`,
        [
          id,
          "Updated",
          `Vehicle ${vehicle_number} updated. Driver: ${
            driver_name || "None"
          }, Area: ${area_assigned}, Status: ${status || "Active"}, Fuel: ${
            fuel_level || 0
          }%`,
        ],
        (logErr) => {
          if (logErr) {
            console.error("Vehicle update log error:", logErr);
          }
        }
      );

      res.json({ message: "Vehicle updated successfully" });
    }
  );
});

// Delete vehicle
app.delete("/api/vehicles/:id", (req, res) => {
  const { id } = req.params;

  db.query(`DELETE FROM vehicles WHERE id = ?`, [id], (err) => {
    if (err) {
      console.error("DELETE /api/vehicles/:id error:", err);
      return res.status(500).json({ error: "Failed to delete vehicle" });
    }

    res.json({ message: "Vehicle deleted successfully" });
  });
});

// Quick status update
app.put("/api/vehicles/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["Active", "Maintenance", "Inactive"];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  db.query(
    `UPDATE vehicles SET status = ? WHERE id = ?`,
    [status, id],
    (err) => {
      if (err) {
        console.error("PUT /api/vehicles/:id/status error:", err);
        return res.status(500).json({ error: "Failed to update vehicle status" });
      }

      db.query(
        `INSERT INTO vehicle_logs (vehicle_id, log_type, description) VALUES (?, ?, ?)`,
        [id, "Status", `Vehicle status changed to ${status}`],
        (logErr) => {
          if (logErr) {
            console.error("Vehicle status log error:", logErr);
          }
        }
      );

      res.json({ message: "Vehicle status updated successfully" });
    }
  );
});

// Get vehicle logs
app.get("/api/vehicles/:id/logs", (req, res) => {
  const { id } = req.params;

  db.query(
    `SELECT * FROM vehicle_logs WHERE vehicle_id = ? ORDER BY created_at DESC`,
    [id],
    (err, results) => {
      if (err) {
        console.error("GET /api/vehicles/:id/logs error:", err);
        return res.status(500).json({ error: "Failed to fetch vehicle logs" });
      }

      res.json(results);
    }
  );
});



/* ==========================================================
   ✅ FORGOT PASSWORD
========================================================== */
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const userEmail = email.trim().toLowerCase();

    const [users] = await db.promise().query(
      "SELECT id, email, full_name FROM users WHERE LOWER(email) = ? LIMIT 1",
      [userEmail]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "No account found with this email",
      });
    }

    const user = users[0];
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.promise().query(
      "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?",
      [resetToken, expiry, user.id]
    );

    const resetLink = `https://siya-naik.github.io/ecotrack/#/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `"EcoTrack" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "EcoTrack Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2 style="margin-bottom: 8px;">Password Reset Request</h2>
          <p>Hello ${user.full_name || "User"},</p>
          <p>You requested to reset your EcoTrack password.</p>
          <p>Click the button below to set a new password:</p>
          <p style="margin: 20px 0;">
            <a
              href="${resetLink}"
              target="_blank"
              style="
                display:inline-block;
                background:#2f8f62;
                color:#fff;
                text-decoration:none;
                padding:12px 20px;
                border-radius:8px;
                font-weight:600;
              "
            >
              Reset Password
            </a>
          </p>
          <p>Or open this link manually:</p>
          <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: "Reset link sent successfully to your email",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      message: "Failed to send reset email",
      error: error.message,
    });
  }
});

/* ==========================================================
   ✅ RESET PASSWORD
========================================================== */
app.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !String(token).trim()) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (String(password).trim().length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const [users] = await db.promise().query(
      "SELECT id, reset_token, reset_token_expiry FROM users WHERE reset_token = ? LIMIT 1",
      [String(token).trim()]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const user = users[0];

    if (
      !user.reset_token_expiry ||
      new Date(user.reset_token_expiry).getTime() < Date.now()
    ) {
      return res.status(400).json({ message: "Reset token has expired" });
    }

    const hashedPassword = await bcrypt.hash(String(password).trim(), 10);

    await db.promise().query(
      `UPDATE users
       SET password = ?, reset_token = NULL, reset_token_expiry = NULL
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    return res.status(200).json({
      message: "Password reset successful. You can now log in.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
});

app.post("/verify-email", (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const query = `
    SELECT id, email_otp, email_otp_expiry, is_verified
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  db.query(query, [normalizedEmail], (err, rows) => {
    if (err) {
      console.error("VERIFY EMAIL ERROR:", err);
      return res.status(500).json({ message: "Verification failed" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    if (user.is_verified === 1) {
      return res.status(200).json({ message: "Email already verified" });
    }

    if (!user.email_otp || user.email_otp !== otp.trim()) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const now = new Date();
    const expiry = new Date(user.email_otp_expiry);

    if (now > expiry) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const updateQuery = `
      UPDATE users
      SET is_verified = 1,
          email_otp = NULL,
          email_otp_expiry = NULL
      WHERE id = ?
    `;

    db.query(updateQuery, [user.id], (updateErr) => {
      if (updateErr) {
        console.error("UPDATE VERIFY ERROR:", updateErr);
        return res.status(500).json({ message: "Could not verify email" });
      }

      return res.status(200).json({ message: "Email verified successfully" });
    });
  });
});
app.post("/send-otp", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  const checkQuery = "SELECT id FROM users WHERE email = ? LIMIT 1";

  db.query(checkQuery, [normalizedEmail], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Error checking email" });

    if (rows.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const insertOtpQuery = `
      INSERT INTO email_otps (email, otp, expiry)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE otp=?, expiry=?
    `;

    db.query(
      insertOtpQuery,
      [normalizedEmail, otp, otpExpiry, otp, otpExpiry],
      async (err2) => {
        if (err2) {
          return res.status(500).json({ message: "Could not save OTP" });
        }

        

        return res.json({ message: "OTP sent successfully" });
      }
    );
  });
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  const query = `
    SELECT * FROM email_otps
    WHERE email = ?
    LIMIT 1
  `;

  db.query(query, [normalizedEmail], (err, rows) => {
    if (err) return res.status(500).json({ message: "Error" });

    if (rows.length === 0) {
      return res.status(400).json({ message: "No OTP found" });
    }

    const record = rows[0];

    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date() > new Date(record.expiry)) {
      return res.status(400).json({ message: "OTP expired" });
    }

    return res.json({ message: "OTP verified" });
  });
});

app.post("/resend-otp", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  const findUserQuery = `
    SELECT id, is_verified
    FROM users
    WHERE email = ?
    LIMIT 1
  `;

  db.query(findUserQuery, [normalizedEmail], (findErr, rows) => {
    if (findErr) {
      console.error("RESEND FIND ERROR:", findErr);
      return res.status(500).json({ message: "Could not process request" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = rows[0];

    if (user.is_verified === 1) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const updateOtpQuery = `
      UPDATE users
      SET email_otp = ?, email_otp_expiry = ?
      WHERE id = ?
    `;

    db.query(updateOtpQuery, [otp, otpExpiry, user.id], async (updateErr) => {
      if (updateErr) {
        console.error("RESEND UPDATE ERROR:", updateErr);
        return res.status(500).json({ message: "Could not resend OTP" });
      }

      try {
        
        return res.status(200).json({ message: "OTP resent successfully" });
      } catch (mailErr) {
        console.error("RESEND MAIL ERROR:", mailErr);
        return res.status(500).json({ message: "OTP email failed" });
      }
    });
  });
});

app.get("/test-mail", async (req, res) => {
  try {
    await sendVerificationEmail(process.env.EMAIL_USER, "123456");
    res.send("Email sent ✅");
  } catch (err) {
    console.error("TEST MAIL ERROR:", err);
    res.send("Email failed ❌ Check terminal");
  }
});
// =======================
// ✅ START SERVER
// =======================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT} 🚀`)
);
