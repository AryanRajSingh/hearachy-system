const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ DB Connected Successfully");
    connection.release();
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
  }
})();

module.exports = db;
