const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const { signAgentToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

const AGENT_EMOJIS = ['🧑‍💼', '👩‍💼', '👨‍💼', '🧑🏽‍💼', '👩🏻‍💼', '👨🏿‍💼'];

/**
 * Self-service signup so testers (other insurance agents, sponsors) can try
 * the app with their own representative account. Passwords are bcrypt-hashed
 * before they ever reach the database — never stored in plain text. New
 * agents see the same seeded demo customers as the demo account.
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await db.prepare(`SELECT id FROM agents WHERE email = ?`).get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists — try signing in instead' });

  const id = genId('agent');
  const hash = bcrypt.hashSync(password, 10);
  const emoji = AGENT_EMOJIS[Math.floor(Math.random() * AGENT_EMOJIS.length)];
  await db
    .prepare(`INSERT INTO agents (id, name, email, password_hash, role, avatar_emoji) VALUES (?, ?, ?, ?, 'agent', ?)`)
    .run(id, name.trim(), normalizedEmail, hash, emoji);

  const agent = await db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id);
  const token = signAgentToken(agent);
  res.status(201).json({ token, agent: publicAgent(agent) });
});

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
