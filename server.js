// ---------------------- ENV & IMPORTS ----------------------
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import db from "./db.js"; // ✅ IMPORTANT

// require("dotenv").config();


// ---------------------- FIX __dirname (ES MODULE) ----------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------- APP SETUP ----------------------
const app = express();

app.use(cors());
app.use(express.json()); // replaces body-parser
app.use(express.static(path.join(__dirname, "public")));

// ---------------------- HEALTH CHECK ----------------------
app.get("/", (req, res) => {
  res.send("🚀 Hierarchy System API is running successfully!");
});

// ---------------------- AUTH ----------------------

// SIGNUP
app.post("/signup", async (req, res) => {
  try {
    let { username, email, password, role } = req.body;

    // 🔒 sanitize inputs
    username = username?.trim();
    email = email?.trim().toLowerCase();
    password = password?.trim();
    role = role?.trim();

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // check if email already exists
    const [existingUsers] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // insert user
    await db.query(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, role]
    );

    res.status(201).json({
      message: "User registered successfully"
    });

  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// LOGIN
// ======================= LOGIN =======================
app.post("/login", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);

    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    console.log("EMAIL:", email);

    const [users] = await db.query(
      "SELECT id, username, email, password, role FROM users WHERE email = ?",
      [email.toLowerCase()]
    );

    console.log("USERS:", users);

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];

    console.log("HASHED PASSWORD:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("PASSWORD MATCH:", isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("JWT SECRET:", process.env.JWT_SECRET);

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR FULL:", err);
    return res.status(500).json({
      message: "Internal Server Error",
      error: err.message
    });
  }
});



// ---------------------- PROTECTED ROUTE ----------------------
app.get("/admin-only", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }
    res.json({ message: "Welcome Admin!" });
  } catch {
    res.status(400).json({ message: "Invalid token" });
  }
});

// ---------------------- DOMAINS & INDUSTRIES ----------------------

// GET all domains
app.get("/api/domains", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        d.id AS domain_id,
        d.name AS domain_name,
        i.id AS industry_id,
        i.name AS industry_name
      FROM domains d
      LEFT JOIN industries i ON i.domain_id = d.id
      ORDER BY d.name, i.name
    `);

    const domainsMap = {};

    rows.forEach(row => {
      if (!domainsMap[row.domain_id]) {
        domainsMap[row.domain_id] = {
          id: row.domain_id,
          name: row.domain_name,
          industries: []
        };
      }

      if (row.industry_id) {
        domainsMap[row.domain_id].industries.push({
          id: row.industry_id,
          name: row.industry_name
        });
      }
    });

    res.json(Object.values(domainsMap));
  } catch (err) {
    console.error("❌ Domains API Error:", err);
    res.status(500).json({ error: "Failed to fetch domains" });
  }
});

// ADD domain
app.post("/api/domains", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Domain name required" });

  try {
    const [result] = await db.query(
      "INSERT INTO domains (name) VALUES (?)",
      [name]
    );
    res.status(201).json({ id: result.insertId, name, industries: [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to create domain" });
  }
});

// ADD industry
app.post("/api/domains/:domainId/industries", async (req, res) => {
  const domainId = Number(req.params.domainId);
  const { name } = req.body;

  if (!domainId || !name) {
    return res.status(400).json({ error: "Invalid domain ID or name" });
  }

  try {
    await db.query(
      "INSERT INTO industries (name, domain_id) VALUES (?, ?)",
      [name, domainId]
    );
    res.status(201).json({ name, domain_id: domainId });
  } catch {
    res.status(500).json({ error: "Failed to create industry" });
  }
});

// DELETE domain
app.delete("/api/domains/:domainId", async (req, res) => {
  const domainId = Number(req.params.domainId);

  try {
    await db.query("DELETE FROM industries WHERE domain_id = ?", [domainId]);
    await db.query("DELETE FROM domains WHERE id = ?", [domainId]);
    res.json({ message: "Domain deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete domain" });
  }
});

// DELETE industry
app.delete("/api/industries/:industryId", async (req, res) => {
  const industryId = Number(req.params.industryId);

  try {
    await db.query("DELETE FROM industries WHERE id = ?", [industryId]);
    res.json({ message: "Industry deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete industry" });
  }
});

// ---------------------- START SERVER ----------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
