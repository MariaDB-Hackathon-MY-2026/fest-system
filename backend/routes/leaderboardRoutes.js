const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {
  const sql = `
    SELECT f.name AS faculty_name, k.total_points, k.last_updated 
    FROM kpi_leaderboard k
    JOIN faculties f ON k.faculty_id = f.id
    ORDER BY k.total_points DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

module.exports = router;