const express = require("express");
const router = express.Router();
const db = require("../db");

// POST /api/attendance/scan
// Handles both QR Codes (eventId) and Manual Entry (eventCode)
router.post("/scan", async (req, res) => {
    const { userId, eventId, eventCode } = req.body;

    if (!userId) {
        return res.status(400).json({ success: false, message: "User not logged in." });
    }

    try {
        let targetEventId = eventId;

        // 1. Did they type the 6-Digit Code? Let's find the event ID.
        if (eventCode) {
            const [events] = await db.query(
                'SELECT id FROM events WHERE random_code = ?', 
                [eventCode]
            );
            
            if (events.length === 0) {
                return res.status(404).json({ success: false, message: "Invalid 6-digit code! ❌" });
            }
            targetEventId = events[0].id;
        }

        if (!targetEventId) {
            return res.status(400).json({ success: false, message: "Missing Event data." });
        }

        // 2. The Time-Gate Check
        const [activeCheck] = await db.query(
            'SELECT id FROM events WHERE id = ? AND NOW() BETWEEN start_time AND end_time',
            [targetEventId]
        );

        if (activeCheck.length === 0) {
            return res.status(403).json({ success: false, message: "This event is not active or has already ended! 🕒" });
        }

        // 3. The "Spam-Proof" Insert
        await db.query(
            'INSERT INTO attendance (user_id, event_id) VALUES (?, ?)',
            [userId, targetEventId]
        );

        res.json({ success: true, message: "Points Awarded! 🎉" });

    } catch (err) {
        // 4. Catch the MariaDB Unique Key Violation
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "You already claimed points for this event! 🛑" });
        }
        
        console.error("Scan Error:", err);
        res.status(500).json({ success: false, message: "Server error during scan." });
    }
});

// GET /api/attendance/history/:userId
// Feeds the "My Profile" tab so students can see what they attended
router.get("/history/:userId", async (req, res) => {
    try {
        const [history] = await db.query(`
            SELECT e.event_name, e.kpi_points, a.scanned_at
            FROM attendance a
            JOIN events e ON a.event_id = e.id
            WHERE a.user_id = ?
            ORDER BY a.scanned_at DESC
        `, [req.params.userId]);

        res.json({
            success: true,
            data: history
        });

    } catch (err) {
        console.error("History Error:", err);
        res.status(500).json({ success: false, message: "Could not load history." });
    }
});

module.exports = router;