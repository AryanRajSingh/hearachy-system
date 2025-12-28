import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const db = await mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),   // ✅ THIS WAS MISSING
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false           // ✅ REQUIRED for Aiven
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default db;
