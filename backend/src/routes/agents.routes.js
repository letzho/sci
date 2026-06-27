const express = require('express');
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function publicAgent(row) {
  return { id: row.id, name: row.name, email: row.email, avatarEmoji: row.avatar_emoji };
}

// Public on purpose: the Client Portal demo needs to know which agent to
// reach without requiring a customer login system. In production this
// would instead come from an actual customer-agent assignment.
router.get('/primary', async (req, res) => {
  const agent = await db.prepare(`SELECT * FROM agents ORDER BY created_at ASC LIMIT 1`).get();
  if (!agent) return res.status(404).json({ error: 'No agents seeded yet' });
  res.json({ agent: publicAgent(agent) });
});

router.get('/', requireAuth, async (req, res) => {
  const agents = await db.prepare(`SELECT * FROM agents ORDER BY created_at ASC`).all();
  res.json({ agents: agents.map(publicAgent) });
});

module.exports = router;
