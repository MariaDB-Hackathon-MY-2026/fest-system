const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/scan", (req, res) => {
  const { user_id, event_id } = req.body;

  // 1. Mark as Attended (handles RSVP update OR new Walk-in)
  const attendSql = `
    INSERT INTO attendance (user_id, event_id, status)
    VALUES (?, ?, 'Attended')
    ON DUPLICATE KEY UPDATE status = 'Attended'
  `;

  db.query(attendSql, [user_id, event_id], (err, result) => {
    if (err) return res.status(500).json(err);

    // 2. Automatically Update KPI Leaderboard
    const kpiSql = `
      UPDATE kpi_leaderboard k
      JOIN users u ON u.id = ?
      JOIN events e ON e.id = ?
      SET k.total_points = k.total_points + e.kpi_points
      WHERE k.faculty_id = u.faculty_id
    `;

    db.query(kpiSql, [user_id, event_id], (kpiErr) => {
      if (kpiErr) return res.status(500).json({ error: "KPI update failed" });
      res.json({ message: "Attendance & KPI Points Updated! ✅" });
    });
  });
});

module.exports = router;