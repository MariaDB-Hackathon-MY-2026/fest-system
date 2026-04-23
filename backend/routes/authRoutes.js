const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/login", (req, res) => {
  const { student_id, password } = req.body;
  const sql = "SELECT id, name, faculty_id FROM users WHERE id = ? AND password = ?";
  
  db.query(sql, [student_id, password], (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length > 0) {
      res.json({ success: true, user: results[0] });
    } else {
      res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }
  });
});

module.exports = router;