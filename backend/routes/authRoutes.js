const express = require("express");
const router = express.Router();
const db = require("../db"); // Your modern promise pool

// LOGIN ROUTE
// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { id, password } = req.body;

    // Basic Validation
    if (!id || !password) {
        return res.status(400).json({ 
            success: false, 
            message: "Student ID and Password are required." 
        });
    }

    try {
        // Query the database for the user
        // We join with 'faculties' to get the faculty name and color immediately
        const [users] = await db.query(`
            SELECT u.id, u.name, u.role, u.faculty_id, f.short_name as faculty_name, f.brand_color
            FROM users u
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE u.id = ? AND u.password = ?
        `, [id, password]);

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid Student ID or Password." 
            });
        }

        const user = users[0];

        // SUCCESS
        // In a production app, you would use a JWT token here.
        // For a hackathon, sending the user object is often enough for the demo.
        res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                facultyId: user.faculty_id,
                facultyName: user.faculty_name,
                brandColor: user.brand_color
            }
        });

    } catch (err) {
        console.error("Auth Error:", err);
        res.status(500).json({ success: false, message: "Server error during login." });
    }
});

module.exports = router;