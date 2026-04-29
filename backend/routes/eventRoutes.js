const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// --- Helper Function: The 6-Digit Generator ---
// We use a recursive-style check to guarantee the code is 100% unique
async function generateUniqueCode() {
    let isUnique = false;
    let code;

    while (!isUnique) {
        // Generate a random number between 100000 and 999999
        code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if MariaDB already has this code
        const [rows] = await db.query('SELECT id FROM events WHERE random_code = ?', [code]);
        if (rows.length === 0) {
            isUnique = true; 
        }
    }
    return code;
}

// POST /api/events/create (Organizer/Admin only)
router.post("/create", authenticateToken, authorizeRoles('admin', 'lecturer'), async (req, res) => {
    const { eventName, description, kpiPoints, startTime, endTime, maxCapacity, organizedByFaculty } = req.body;
    const createdBy = req.user.id; // Securely pulled from the JWT

    try {
        // 1. Generate the failsafe code
        const eventCode = await generateUniqueCode();

        // 2. Insert into the database
        const [result] = await db.query(`
            INSERT INTO events 
            (event_name, description, kpi_points, random_code, start_time, end_time, created_by, max_capacity, organized_by_faculty) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [eventName, description, kpiPoints || 10, eventCode, startTime, endTime, createdBy, maxCapacity || null, organizedByFaculty || null]);

        // 3. Return the success message and the new code so the Organizer can write it on the whiteboard
        res.json({
            success: true,
            message: "Event created successfully!",
            data: {
                eventId: result.insertId,
                eventCode: eventCode
            }
        });

    } catch (err) {
        console.error("Event Creation Error:", err);
        res.status(500).json({ success: false, message: "Failed to create event." });
    }
});

// GET /api/events/active
// Students use this to see what events are happening RIGHT NOW
router.get("/active", async (req, res) => {
    try {
        // We use MariaDB's NOW() function to handle the time-gate
        const [activeEvents] = await db.query(`
            SELECT id, event_name, description, kpi_points, start_time, end_time 
            FROM events 
            WHERE NOW() BETWEEN start_time AND end_time
            ORDER BY end_time ASC
        `);

        res.json({
            success: true,
            data: activeEvents
        });

    } catch (err) {
        console.error("Fetch Active Events Error:", err);
        res.status(500).json({ success: false, message: "Could not load events." });
    }
});

// GET /api/events/manage
// Organizers and Admins use this to manage events and see the secret codes
router.get("/manage", authenticateToken, authorizeRoles('admin', 'lecturer', 'organizer'), async (req, res) => {
    try {
        let query = `SELECT id, event_name, description, kpi_points, random_code, start_time, end_time FROM events ORDER BY start_time DESC`;
        let params = [];
        
        // If the user is just a lecturer/organizer, only show events THEY created
        if (req.user.role !== 'admin') {
            query = `SELECT id, event_name, description, kpi_points, random_code, start_time, end_time FROM events WHERE created_by = ? ORDER BY start_time DESC`;
            params = [req.user.id];
        }

        const [manageEvents] = await db.query(query, params);
        
        res.json({
            success: true,
            data: manageEvents
        });
    } catch (err) {
        console.error("Manage Events Error:", err);
        res.status(500).json({ success: false, message: "Could not load management events." });
    }
});

// DELETE /api/events/:eventId (Organizer/Admin only)
router.delete("/:eventId", authenticateToken, authorizeRoles('admin', 'lecturer', 'organizer'), async (req, res) => {
    const { eventId } = req.params;
    const { id: userId, role: userRole } = req.user;

    try {
        // Security Check: Only allow admins to delete any event, or organizers to delete their own.
        if (userRole !== 'admin') {
            const [events] = await db.query('SELECT created_by FROM events WHERE id = ?', [eventId]);
            if (events.length === 0) {
                return res.status(404).json({ success: false, message: "Event not found." });
            }
            if (events[0].created_by !== userId) {
                return res.status(403).json({ success: false, message: "Forbidden: You can only delete your own events." });
            }
        }

        // 1. Fetch event points to know how much to deduct per scan
        const [eventData] = await db.query('SELECT kpi_points FROM events WHERE id = ?', [eventId]);
        if (eventData.length === 0) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const pointsPerScan = eventData[0].kpi_points;

        // 2. Calculate deductions per faculty before deleting attendance
        const [deductions] = await db.query(`
            SELECT u.faculty_id, COUNT(a.id) as scan_count 
            FROM attendance a 
            JOIN users u ON a.user_id = u.id 
            WHERE a.event_id = ? AND u.faculty_id IS NOT NULL 
            GROUP BY u.faculty_id
        `, [eventId]);

        // 3. Apply deductions to the leaderboard
        for (const row of deductions) {
            const totalPointsToDeduct = pointsPerScan * row.scan_count;
            await db.query(`
                UPDATE kpi_leaderboard 
                SET total_points = GREATEST(0, total_points - ?), 
                    total_scans = GREATEST(0, total_scans - ?) 
                WHERE faculty_id = ?
            `, [totalPointsToDeduct, row.scan_count, row.faculty_id]);
        }

        // 4. Handle Foreign Key: Delete associated attendance records first.
        await db.query('DELETE FROM attendance WHERE event_id = ?', [eventId]);
        
        // 5. Delete the event itself.
        const [result] = await db.query('DELETE FROM events WHERE id = ?', [eventId]);

        // 6. Force clear leaderboard cache and notify frontends
        if (typeof global.clearLeaderboardCache === 'function') {
            global.clearLeaderboardCache();
        }
        const io = req.app.get("io");
        if (io) {
            io.emit("leaderboardUpdated", { message: `🗑️ Event deleted, leaderboard recalculated.` });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Event not found or already deleted." });
        }

        res.json({ success: true, message: "Event and all its attendance records have been deleted." });

    } catch (err) {
        console.error("Delete Event Error:", err);
        res.status(500).json({ success: false, message: "Server error during event deletion." });
    }
});

// GET /api/events/export/:eventId
// Generates a CSV file of all students who attended a specific event
router.get("/export/:eventId", authenticateToken, authorizeRoles('admin', 'lecturer'), async (req, res) => {
    try {
        const eventId = req.params.eventId;
        
        const [attendance] = await db.query(`
            SELECT u.id as student_id, u.name, f.short_name as faculty, a.scanned_at
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE a.event_id = ?
            ORDER BY a.scanned_at ASC
        `, [eventId]);

        if (attendance.length === 0) {
            return res.status(404).send("No attendance records found for this event.");
        }

        // Build CSV string
        let csv = "Student ID,Name,Faculty,Scanned At\n";
        attendance.forEach(row => {
            csv += `${row.student_id},"${row.name}",${row.faculty},"${row.scanned_at}"\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`attendance_event_${eventId}.csv`);
        return res.send(csv);
        
    } catch (err) {
        console.error("Export Error:", err);
        res.status(500).json({ success: false, message: "Failed to export attendance." });
    }
});

module.exports = router;