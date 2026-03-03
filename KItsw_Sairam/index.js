const express = require("express");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL connection
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
  } else {
    console.log("✅ Connected to MySQL Database");
  }
});

app.get("/", (req, res) => {
  res.send("Engineering College Application is running 🚀");
});

app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) return res.send("❌ Database connection failed");
    res.send("✅ Database connected successfully");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
