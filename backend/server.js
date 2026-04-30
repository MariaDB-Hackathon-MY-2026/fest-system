require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // Added for file path handling
const db = require("./db");   // Your modern promise pool
const http = require("http"); // Core Node.js module
const { Server } = require("socket.io");

const app = express();

// --- Environment Check ---
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in .env file.");
    process.exit(1);
}

const server = http.createServer(app);

// --- Socket.io Setup ---
const io = new Server(server, {
    cors: {
        origin: "*", // In production, restrict this to your frontend domain
        methods: ["GET", "POST"]
    }
});

// Make io accessible inside our route files using req.app.get('io')
app.set("io", io);

io.on("connection", (socket) => {
    console.log(`🔌 Real-time client connected: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// --- Middleware ---
app.use(cors());
app.use(express.json());

// 1. SERVE FRONTEND: This is crucial. 
// It serves your HTML, CSS, and JS from the '../frontend' folder.
app.use(express.static(path.join(__dirname, '../frontend')));

// --- API Endpoints ---
// We'll prefix these with /api to keep things organized
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const facultyRoutes = require("./routes/facultyRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/faculties", facultyRoutes);

// --- Routes ---

// 2. ROOT ROUTE: Instead of just text, let's serve the index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
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
server.listen(PORT, () => { // Note: using server.listen instead of app.listen
    console.log(`
    🚀 FESt System is live!
    📡 URL: http://localhost:${PORT}
    🗄️  DB: ${process.env.DB_NAME}
    ---------------------------------
    Waiting for students to scan...
    `);
});