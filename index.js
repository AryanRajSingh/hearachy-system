require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------- MySQL Connection ----------------------
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
});

db.connect(err => {
  if (err) console.error("❌ DB Connection Error:", err);
  else console.log("✅ Connected to MySQL Database!");
});

app.set('db', db);

// ---------------------- AUTH ----------------------
app.post('/signup', async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role)
    return res.status(400).json({ message: 'All fields are required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json(err);
    if (results.length) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: `${role} registered successfully!` });
      }
    );
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email & password required' });

  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json(err);
    if (!results.length) return res.status(400).json({ message: 'User not found' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  });
});

// ---------------------- PROTECTED ROUTE EXAMPLE ----------------------
app.get('/admin-only', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
    res.json({ message: 'Welcome Admin!' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
});

// ---------------------- DOMAINS & INDUSTRIES ----------------------

// GET all domains with industries
app.get('/api/domains', async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT d.id AS domain_id, d.name AS domain_name, i.id AS industry_id, i.name AS industry_name
      FROM domains d
      LEFT JOIN industries i ON i.domain_id = d.id
      ORDER BY d.name, i.name
    `);

    const domainsMap = {};
    rows.forEach(row => {
      if (!domainsMap[row.domain_id]) domainsMap[row.domain_id] = { id: row.domain_id, name: row.domain_name, industries: [] };
      if (row.industry_id) domainsMap[row.domain_id].industries.push({ id: row.industry_id, name: row.industry_name });
    });

    res.json(Object.values(domainsMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// POST add a new domain
app.post('/api/domains', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Domain name required' });

  try {
    const [result] = await db.promise().query('INSERT INTO domains (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name, industries: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create domain' });
  }
});

// POST add a new industry
app.post('/api/domains/:domainId/industries', async (req, res) => {
  const domainId = parseInt(req.params.domainId);
  const { name } = req.body;
  if (!domainId || !name) return res.status(400).json({ error: 'Invalid domain ID or name' });

  try {
    const [domain] = await db.promise().query('SELECT * FROM domains WHERE id = ?', [domainId]);
    if (!domain.length) return res.status(404).json({ error: 'Domain not found' });

    const [result] = await db.promise().query('INSERT INTO industries (name, domain_id) VALUES (?, ?)', [name, domainId]);
    res.status(201).json({ id: result.insertId, name, domain_id: domainId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create industry' });
  }
});

// DELETE domain (and its industries)
app.delete('/api/domains/:domainId', async (req, res) => {
  const domainId = parseInt(req.params.domainId);
  if (!domainId) return res.status(400).json({ error: 'Invalid domain ID' });

  try {
    await db.promise().query('DELETE FROM industries WHERE domain_id = ?', [domainId]);
    await db.promise().query('DELETE FROM domains WHERE id = ?', [domainId]);
    res.json({ message: 'Domain deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

// DELETE industry
app.delete('/api/industries/:industryId', async (req, res) => {
  const industryId = parseInt(req.params.industryId);
  if (!industryId) return res.status(400).json({ error: 'Invalid industry ID' });

  try {
    await db.promise().query('DELETE FROM industries WHERE id = ?', [industryId]);
    res.json({ message: 'Industry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete industry' });
  }
});

// PATCH edit domain
app.patch('/api/domains/:domainId', async (req, res) => {
  const domainId = parseInt(req.params.domainId);
  const { name } = req.body;
  if (!domainId || !name) return res.status(400).json({ error: 'Invalid domain ID or name' });

  try {
    await db.promise().query('UPDATE domains SET name = ? WHERE id = ?', [name, domainId]);
    res.json({ message: 'Domain updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

// PATCH edit industry
app.patch('/api/industries/:industryId', async (req, res) => {
  const industryId = parseInt(req.params.industryId);
  const { name, domain_id } = req.body;
  if (!industryId || !name || !domain_id) return res.status(400).json({ error: 'Invalid data' });

  try {
    const [domain] = await db.promise().query('SELECT * FROM domains WHERE id = ?', [domain_id]);
    if (!domain.length) return res.status(404).json({ error: 'Parent domain not found' });

    await db.promise().query('UPDATE industries SET name=?, domain_id=? WHERE id=?', [name, domain_id, industryId]);
    res.json({ message: 'Industry updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update industry' });
  }
});

// ---------------------- START SERVER ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
