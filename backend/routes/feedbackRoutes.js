const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/submit", (req, res) => {
  const { user_id, event_id, rating, comment } = req.body;

  // 1. Save the feedback
  const feedbackSql = "INSERT INTO feedback (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)";
  
  db.query(feedbackSql, [user_id, event_id, rating, comment], (err) => {
    if (err) return res.status(500).json(err);

    // 2. Award 5 BONUS points to the faculty for the engagement
    const bonusSql = `
      UPDATE kpi_leaderboard k
      JOIN users u ON u.id = ?
      SET k.total_points = k.total_points + 5
      WHERE k.faculty_id = u.faculty_id
    `;

    db.query(bonusSql, [user_id], (bonusErr) => {
      res.json({ message: "Review submitted! +5 Bonus Points for your Faculty! ⭐" });
    });
  });
});

module.exports = router;