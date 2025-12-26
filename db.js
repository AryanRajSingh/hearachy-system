// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection (SAFE way)
(async () => {
  try {
    await db.query('SELECT 1');
    console.log('✅ Connected to MySQL Database!');
  } catch (err) {
    console.error('❌ DB Connection Error:', err.message);
  }
})();

module.exports = db;
