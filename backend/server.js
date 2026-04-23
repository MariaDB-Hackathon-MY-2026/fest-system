const express = require("express");
const cors = require("cors");
const db = require("./db");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const facultyRoutes = require("./routes/facultyRoutes");
const eventRoutes = require("./routes/eventRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Use Routes
app.use("/auth", authRoutes);
app.use("/faculties", facultyRoutes);
app.use("/events", eventRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/leaderboard", leaderboardRoutes);

app.get("/", (req, res) => {
  res.send("FESt Backend API is Live 🚀");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});