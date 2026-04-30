const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// POST /api/attendance/scan
// Handles both QR Codes (eventId) and Manual Entry (eventCode)
router.post("/scan", authenticateToken, async (req, res) => {
    const { eventId, eventCode } = req.body;
    const userId = req.user.id; // Securely extracted from JWT, impossible to fake!

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

        // 2. The Time-Gate & Capacity Check combined!
        // We leverage MariaDB to count the current attendees and check the time in a single query.
        const [activeCheck] = await db.query(`
            SELECT e.id, e.max_capacity, COUNT(a.user_id) as current_attendees
            FROM events e
            LEFT JOIN attendance a ON e.id = a.event_id
            WHERE e.id = ? 
              AND NOW() BETWEEN e.start_time AND e.end_time
            GROUP BY e.id
        `, [targetEventId]);

        if (activeCheck.length === 0) {
            return res.status(403).json({ success: false, message: "This event is not active or has already ended! 🕒" });
        }

        const eventData = activeCheck[0];
        if (eventData.max_capacity !== null && eventData.current_attendees >= eventData.max_capacity) {
            return res.status(403).json({ success: false, message: "This event has reached its maximum capacity! 🚪" });
        }

        // 3. The "Spam-Proof" Insert (This part works!)
        await db.query(
            'INSERT INTO attendance (user_id, event_id) VALUES (?, ?)',
            [userId, targetEventId]
        );

        // 🌟 NEW: THE PAYOUT LOGIC (Add this right here!)
        // Handle both camelCase and snake_case based on how JWT was signed
        const facultyId = req.user.facultyId || req.user.faculty_id; 
        
        // Admins/SuperAdmins have facultyId = NULL, so we only update if it's a student
        if (facultyId) {
            // A. Find out how many points this specific event is worth
            const [eventInfo] = await db.query('SELECT kpi_points FROM events WHERE id = ?', [targetEventId]);
            const pointsToAward = eventInfo[0].kpi_points;

            // B. Direct Update (Avoids "On Duplicate Key" issues and deprecated VALUES() syntax)
            await db.query(`
                UPDATE kpi_leaderboard 
                SET total_points = total_points + ?, 
                    total_scans = total_scans + 1 
                WHERE faculty_id = ?
            `, [Number(pointsToAward), facultyId]);
            
            console.log(`📈 Leaderboard Updated: +${pointsToAward} points for Faculty ID ${facultyId}`);
        }
        
        // Force clear the leaderboard cache globally so frontend gets fresh data!
        if (typeof global.clearLeaderboardCache === 'function') {
            global.clearLeaderboardCache();
        }

        // 4. Emit a real-time event to all connected frontends.
        // We removed the cache clearing to prevent a "Thundering Herd" DDoS on our own DB!
        const io = req.app.get("io");
        if (io) {
            io.emit("leaderboardUpdated", { message: `🎓 Student ID ${req.user.id} just scanned in!` });
        }

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
router.get("/history/:userId", authenticateToken, async (req, res) => {
    const requestedUserId = req.params.userId;

    // RBAC: Only the student themselves, or an admin/lecturer can view this history
    if (req.user.id != requestedUserId && !['admin', 'lecturer'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "Forbidden: You can only view your own history." });
    }

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