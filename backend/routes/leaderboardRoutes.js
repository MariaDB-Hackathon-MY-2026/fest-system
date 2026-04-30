const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// --- The Cache System ---
let cachedLeaderboard = null;
let lastFetchTime = 0;
let activeFetchPromise = null; // Our Promise Cache to prevent Thundering Herd
const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

// Expose global cache clearing function so attendanceRoutes can trigger it
global.clearLeaderboardCache = () => {
    console.log("🧹 Global Cache Clear Triggered by Scan!");
    lastFetchTime = 0;
    cachedLeaderboard = null;
};

// GET /api/leaderboard
router.get("/", async (req, res) => {
    const currentTime = Date.now();

    // 1. Check if we have valid cached data
    if (cachedLeaderboard && (currentTime - lastFetchTime < CACHE_DURATION_MS)) {
        console.log("⚡ Serving Leaderboard from Cache!");
        return res.json({
            success: true,
            source: "cache",
            data: cachedLeaderboard
        });
    }

    // 2. Check if a fetch is already in progress (Prevent Thundering Herd)
    if (activeFetchPromise) {
        console.log("⏳ Waiting for existing DB query to finish...");
        const rows = await activeFetchPromise;
        return res.json({
            success: true,
            source: "promise-cache",
            data: rows
        });
    }

    console.log("🗄️ Cache expired! Fetching fresh Leaderboard from DB...");
    try {
        activeFetchPromise = db.query(`
            SELECT v.faculty_id, f.name AS faculty_name, f.short_name, v.brand_color, 
                   v.total_scans, v.total_points, v.participation_rate
            FROM v_kpi_leaderboard v
            JOIN faculties f ON v.faculty_id = f.id
            ORDER BY v.total_points DESC, v.participation_rate DESC
        `).then(([rows]) => rows);

        const rows = await activeFetchPromise;

        // Save the fresh data to our cache, reset timer, and clear active promise
        cachedLeaderboard = rows;
        lastFetchTime = Date.now();
        activeFetchPromise = null;

        // 4. Send the fresh data to the user
        res.json({
            success: true,
            source: "database",
            data: rows
        });

    } catch (err) {
        console.error("Leaderboard Error:", err);
        activeFetchPromise = null;
        res.status(500).json({ 
            success: false, 
            message: "Failed to load the leaderboard." 
        });
    }
});

// GET /api/leaderboard/force-refresh (Admin Only - Optional)
// Useful if an Admin wants to see the absolute live data right now
router.get("/force-refresh", authenticateToken, authorizeRoles('admin'), async (req, res) => {
    // Reset the cache timer
    lastFetchTime = 0; 
    res.json({ success: true, message: "Cache cleared. Next request will hit DB." });
});

module.exports = router;