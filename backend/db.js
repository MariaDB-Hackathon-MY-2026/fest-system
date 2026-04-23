const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "admin123",
  database: "fest_db",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed ❌", err);
  } else {
    console.log("Connected to MariaDB ✅");
  }
});

module.exports = db;