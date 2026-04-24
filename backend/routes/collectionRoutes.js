import express from "express";
import db from "../config/db.js";

const router = express.Router();

/**
 * GET /api/collections/next?userId=1
 * Returns next upcoming pickup from `collections` table for that user.
 */
router.get("/next", (req, res) => {
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  const sql = `
    SELECT id, user_id, title, type, due_date, start_time, end_time, status
    FROM collections
    WHERE user_id = ?
      AND due_date >= CURDATE()
      AND (
        status = 'upcoming'
        OR status = 'Upcoming'
        OR status = 'scheduled'
        OR status = 'Scheduled'
      )
    ORDER BY due_date ASC, start_time ASC
    LIMIT 1
  `;

  db.query(sql, [userId], (err, rows) => {
    if (err) {
      console.error("NEXT PICKUP DB ERROR:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (!rows || rows.length === 0) {
      return res.json({ nextPickup: null });
    }

    return res.json({ nextPickup: rows[0] });
  });
});

/**
 * POST /api/collections/schedule
 * Body: { userId, title, type, dueDate, startTime, endTime }
 */
router.post("/schedule", (req, res) => {
  const { userId, title, type, dueDate, startTime, endTime } = req.body;

  if (!userId || !dueDate || !startTime) {
    return res.status(400).json({
      message: "userId, dueDate, startTime are required",
    });
  }

  const sql = `
    INSERT INTO collections (user_id, title, type, due_date, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, 'upcoming')
  `;

  db.query(
    sql,
    [
      Number(userId),
      title || "Waste Collection",
      type || "General Waste",
      dueDate,
      startTime,
      endTime || null,
    ],
    (err, result) => {
      if (err) {
        console.error("SCHEDULE PICKUP DB ERROR:", err);
        return res.status(500).json({ message: "Database error" });
      }

      return res.status(201).json({
        message: "Pickup scheduled",
        id: result.insertId,
      });
    }
  );
});

export default router;