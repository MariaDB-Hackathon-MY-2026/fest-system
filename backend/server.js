require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // Added for file path handling
const db = require("./db");   // Your modern promise pool

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// 1. SERVE FRONTEND: This is crucial. 
// It serves your HTML, CSS, and JS from the 'public' folder.
app.use(express.static(path.join(__dirname, 'public')));

// --- API Endpoints ---
// We'll prefix these with /api to keep things organized
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaderboard", leaderboardRoutes);

// --- Routes ---

// 2. ROOT ROUTE: Instead of just text, let's serve the index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. GLOBAL ERROR HANDLER: 
// This prevents the server from crashing if a route fails.
app.use((err, req, res, next) => {
    console.error("💥 Server Error:", err.stack);
    res.status(500).json({ 
        success: false, 
        message: "Something went wrong on our end!" 
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 FESt System is live!
    📡 URL: http://localhost:${PORT}
    🗄️  DB: ${process.env.DB_NAME}
    ---------------------------------
    Waiting for students to scan...
    `);
});