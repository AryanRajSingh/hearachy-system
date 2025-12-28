// ======================= ENV & IMPORTS =======================
import dotenv from "dotenv";
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";

dotenv.config();

// ======================= FIX __dirname =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================= APP SETUP ===========================
const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ======================= HEALTH CHECK ========================
app.get("/", (req, res) => {
  res.status(200).send("🚀 Hierarchy System API is running");
});

// ============================================================
// ======================= AUTH ===============================
// ============================================================

// ----------------------- SIGNUP ------------------------------
app.post("/signup", async (req, res) => {
  try {
    let { username, email, password, role } = req.body;

    username = username?.trim();
    email = email?.trim().toLowerCase();
    password = password?.trim();
    role = role?.trim();

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const [existing] = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, role]
    );

    res.status(201).json({ message: "User registered successfully" });

  } catch (err) {
    console.error("❌ SIGNUP ERROR:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ----------------------- LOGIN -------------------------------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing");
      return res.status(500).json({ message: "Server misconfigured" });
    }

    const [users] = await db.query(
      "SELECT id, username, password, role FROM users WHERE email = ?",
      [email.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (err) {
    console.error("🔥 LOGIN ERROR:", err.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ============================================================
// ======================= JWT MIDDLEWARE =====================
// ============================================================
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token missing" });
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// ============================================================
// ======================= ADMIN ONLY =========================
// ============================================================
app.get("/admin-only", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  res.json({ message: "Welcome Admin!" });
});

// ============================================================
// ================= DOMAINS & INDUSTRIES =====================
// ============================================================

// GET domains (PUBLIC)
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

    const map = {};

    for (const r of rows) {
      if (!map[r.domain_id]) {
        map[r.domain_id] = {
          id: r.domain_id,
          name: r.domain_name,
          industries: []
        };
      }
      if (r.industry_id) {
        map[r.domain_id].industries.push({
          id: r.industry_id,
          name: r.industry_name
        });
      }
    }

    res.json(Object.values(map));

  } catch (err) {
    console.error("❌ DOMAINS ERROR:", err.message);
    res.status(500).json({ message: "Failed to fetch domains" });
  }
});

// ADD domain (ADMIN)
app.post("/api/domains", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ message: "Domain name required" });
    }

    const [result] = await db.query(
      "INSERT INTO domains (name) VALUES (?)",
      [name]
    );

    res.status(201).json({ id: result.insertId, name });

  } catch (err) {
    console.error("❌ ADD DOMAIN ERROR:", err.message);
    res.status(500).json({ message: "Failed to create domain" });
  }
});

// ADD industry (ADMIN)
app.post("/api/domains/:domainId/industries", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const domainId = Number(req.params.domainId);
    const name = req.body.name?.trim();

    if (!domainId || !name) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await db.query(
      "INSERT INTO industries (name, domain_id) VALUES (?, ?)",
      [name, domainId]
    );

    res.status(201).json({ name, domain_id: domainId });

  } catch (err) {
    console.error("❌ ADD INDUSTRY ERROR:", err.message);
    res.status(500).json({ message: "Failed to create industry" });
  }
});

// DELETE domain (ADMIN)
app.delete("/api/domains/:domainId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const id = Number(req.params.domainId);
    await db.query("DELETE FROM industries WHERE domain_id = ?", [id]);
    await db.query("DELETE FROM domains WHERE id = ?", [id]);

    res.json({ message: "Domain deleted successfully" });

  } catch (err) {
    console.error("❌ DELETE DOMAIN ERROR:", err.message);
    res.status(500).json({ message: "Delete failed" });
  }
});

// DELETE industry (ADMIN)
app.delete("/api/industries/:industryId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    const id = Number(req.params.industryId);
    await db.query("DELETE FROM industries WHERE id = ?", [id]);

    res.json({ message: "Industry deleted successfully" });

  } catch (err) {
    console.error("❌ DELETE INDUSTRY ERROR:", err.message);
    res.status(500).json({ message: "Delete failed" });
  }
});

// test
app.get("/db-test", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1");
    res.json({ success: true });
  } catch (error) {
    console.error("❌ DB TEST ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ======================= START SERVER =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
