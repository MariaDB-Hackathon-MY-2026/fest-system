const express = require("express");
const router = express.Router();
const db = require("../db");
const QRCode = require('qrcode');

// Get all events
router.get("/", (req, res) => {
  db.query("SELECT * FROM events ORDER BY event_date ASC", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// Generate QR Code for an event
router.get("/:id/qrcode", async (req, res) => {
  const eventId = req.params.id;
  // This URL is what the student's phone scans
  const url = `http://localhost:5173/scan?event=${eventId}`; 

  try {
    const qrImage = await QRCode.toDataURL(url);
    res.json({ qr_code: qrImage }); 
  } catch (err) {
    res.status(500).json({ error: "QR Generation failed" });
  }
});

module.exports = router;