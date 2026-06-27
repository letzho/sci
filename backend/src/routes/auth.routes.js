const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { signAgentToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicAgent(row) {
  return { id: row.id, name: row.name, email: row.email, role: row.role, avatarEmoji: row.avatar_emoji };
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const agent = await db.prepare(`SELECT * FROM agents WHERE email = ?`).get(String(email).toLowerCase());
  if (!agent) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = bcrypt.compareSync(password, agent.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signAgentToken(agent);
  res.json({ token, agent: publicAgent(agent) });
});

router.get('/me', requireAuth, async (req, res) => {
  const agent = await db.prepare(`SELECT * FROM agents WHERE id = ?`).get(req.agent.id);
  if (!agent) return res.status(401).json({ error: 'Session expired — please sign in again' });
  res.json({ agent: publicAgent(agent) });
});

module.exports = router;
