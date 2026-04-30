require('dotenv').config();
const mysql = require('mysql2/promise');

// Create a connection pool (better for handling multiple users)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Simple test to ensure MariaDB is reachable
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Connected to MariaDB via Promise Pool ✅");
    connection.release(); // Return the connection to the pool
  } catch (err) {
    console.error("❌ Database connection failed: ", err.message);
  }
})();

module.exports = pool;