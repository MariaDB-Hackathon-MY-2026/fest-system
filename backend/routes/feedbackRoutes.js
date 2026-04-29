const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

router.post("/submit", authenticateToken, async (req, res) => {
  const { event_id, rating, comment } = req.body;
  const user_id = req.user.id; // Securely grabbed from JWT

  try {
    // 0. Prevent Multiple Submissions (Infinite Point Farming Bug)
    const [existing] = await db.query("SELECT id FROM feedback WHERE user_id = ? AND event_id = ?", [user_id, event_id]);
    if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "You have already submitted feedback for this event!" });
    }

    // 1. Save the feedback
    const feedbackSql = "INSERT INTO feedback (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)";
    
    await db.query(feedbackSql, [user_id, event_id, rating, comment]);

// 2. Award 5 BONUS points to the faculty for the engagement.
    // We use the facultyId securely stored in the JWT payload.
    const facultyId = req.user.facultyId; 
    const bonusSql = `
      UPDATE kpi_leaderboard 
      SET total_points = total_points + 5 
      WHERE faculty_id = ?
    `;

    await db.query(bonusSql, [facultyId]);
    
    res.json({ success: true, message: "Review submitted! +5 Bonus Points for your Faculty! ⭐" });
  } catch (err) {
    console.error("Feedback Error:", err);
    res.status(500).json({ success: false, message: "Failed to submit feedback." });
  }
});

module.exports = router;