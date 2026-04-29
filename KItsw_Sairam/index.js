const express = require("express");
const mysql = require("mysql2");
const app = express();

// Use a POOL instead of single connection (works better on serverless)
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
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

// ⚠️ Do NOT use app.listen() on Vercel
// Only listen locally
if (process.env.NODE_ENV !== "production") {
  app.listen(3000, () => console.log("Running locally on port 3000"));
}

// ✅ This is required for Vercel
module.exports = app;
