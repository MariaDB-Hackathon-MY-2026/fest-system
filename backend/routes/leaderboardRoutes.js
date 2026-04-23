const express = require("express");
const router = express.Router();
const db = require("../db");

// --- The Cache System ---
let cachedLeaderboard = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 30 * 1000; // 30 seconds

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

    // 2. Cache is empty or expired, time to ask MariaDB
    try {
        console.log("🗄️ Fetching fresh Leaderboard from MariaDB View...");
        
        // Notice how clean this is because of our 'v_kpi_leaderboard' view!
        // We sort by total_points DESC so the highest score is always #1
        const [rows] = await db.query(`
            SELECT faculty_id, faculty_name, short_name, brand_color, 
                   total_scans, total_points, participation_rate
            FROM v_kpi_leaderboard
            ORDER BY total_points DESC, participation_rate DESC
        `);

        // 3. Save the fresh data to our cache
        cachedLeaderboard = rows;
        lastFetchTime = currentTime;

        // 4. Send the fresh data to the user
        res.json({
            success: true,
            source: "database",
            data: cachedLeaderboard
        });

    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to load the leaderboard." 
        });
    }
});

// GET /api/leaderboard/force-refresh (Admin Only - Optional)
// Useful if an Admin wants to see the absolute live data right now
router.get("/force-refresh", async (req, res) => {
    // Reset the cache timer
    lastFetchTime = 0; 
    res.json({ success: true, message: "Cache cleared. Next request will hit DB." });
});

module.exports = router;