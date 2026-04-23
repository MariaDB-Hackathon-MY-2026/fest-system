const express = require("express");
const router = express.Router();
const db = require("../db");

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
router.post("/create", async (req, res) => {
    const { eventName, description, kpiPoints, startTime, endTime, createdBy } = req.body;

    try {
        // 1. Generate the failsafe code
        const eventCode = await generateUniqueCode();

        // 2. Insert into the database
        const [result] = await db.query(`
            INSERT INTO events 
            (event_name, description, kpi_points, random_code, start_time, end_time, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eventName, description, kpiPoints || 10, eventCode, startTime, endTime, createdBy]);

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

module.exports = router;