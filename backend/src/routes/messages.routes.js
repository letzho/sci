const express = require('express');
const db = require('../db/connection');
const adminAgent = require('../agents/adminAgent');

const router = express.Router();

router.get('/', async (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId) return res.status(400).json({ error: 'conversationId query param is required' });
  const rows = await db
    .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(conversationId);
  res.json({
    messages: rows.map((m) => ({ id: m.id, sender: m.sender, kind: m.kind, content: m.content, createdAt: m.created_at })),
  });
});

router.post('/', async (req, res) => {
  const { conversationId, sender, kind, content } = req.body || {};
  if (!conversationId || !sender || !content) {
    return res.status(400).json({ error: 'conversationId, sender and content are required' });
  }
  const convo = await db.prepare(`SELECT id FROM conversations WHERE id = ?`).get(conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  const message = await adminAgent.logMessage({ conversationId, sender, kind: kind || 'text', content });
  res.status(201).json({
    message: { id: message.id, sender: message.sender, kind: message.kind, content: message.content, createdAt: message.created_at },
  });
});

module.exports = router;
