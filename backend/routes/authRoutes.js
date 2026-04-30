const express = require("express");
const router = express.Router();
const db = require("../db"); // Your modern promise pool
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
        // We only check by ID here, and retrieve the hashed password for comparison
        const [users] = await db.query(`
            SELECT u.id, u.name, u.role, u.password as hashed_password, u.faculty_id, f.name as faculty_name, f.brand_color
            FROM users u
            LEFT JOIN faculties f ON u.faculty_id = f.id
            WHERE u.id = ?
        `, [id]);

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid Student ID or Password." 
            });
        }

        const user = users[0];

        // Compare the provided plaintext password with the hashed password from the database
        const isMatch = await bcrypt.compare(password, user.hashed_password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid Student ID or Password." });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { id: user.id, role: user.role, facultyId: user.faculty_id },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        // SUCCESS
        res.json({
            success: true,
            message: `Welcome back, ${user.name}!`,
            token: token,
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