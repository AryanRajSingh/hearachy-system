// routes/industryRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // make sure db.js exists

// GET all domains with industries
router.get('/domains', (req, res) => {
  const sql = 'SELECT * FROM domains'; // assuming you have a domains table
  db.query(sql, (err, results) => {
    if(err) return res.status(500).json({ error: err });
    
    // Format data like: [{name:"Telecom", industries:[...]}]
    const domains = results.map(domain => ({
      name: domain.name,
      industries: JSON.parse(domain.industries || '[]') // assuming industries stored as JSON array
    }));
    res.json(domains);
  });
});

module.exports = router;
