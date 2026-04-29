const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (req, res) => {
  try {
    const [faculties] = await db.query("SELECT * FROM faculties");
    res.json({
        success: true,
        data: faculties
    });
  } catch (err) {
    console.error("Faculty Fetch Error:", err);
    res.status(500).json({ success: false, message: "Could not load faculties." });
  }
});

module.exports = router;