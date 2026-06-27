const express = require('express');
const db = require('../db/connection');
const orchestrator = require('../agents/orchestrator');
const adminAgent = require('../agents/adminAgent');

const router = express.Router();

/**
 * Live guidance endpoint used by the Face-to-Face channel (single browser
 * tab, agent's own mic via Web Speech API). Each finalised transcript chunk
 * is POSTed here and answered synchronously with talking points + any
 * compliance flags - no socket needed for this channel.
 */
router.post('/live', async (req, res) => {
  const { conversationId, text, productType, speaker } = req.body || {};
  if (!conversationId || !text) return res.status(400).json({ error: 'conversationId and text are required' });

  const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const guidance = await orchestrator.getLiveGuidance({ text, productType: productType || convo.product_context });
    await adminAgent.logMessage({ conversationId, sender: speaker === 'customer' ? 'customer' : 'agent', kind: 'transcript', content: text });
    await adminAgent.logGuidance(conversationId, guidance);
    res.json({ guidance });
  } catch (err) {
    console.error('[guidance.routes] /live error:', err);
    res.status(500).json({ error: 'Failed to generate guidance' });
  }
});

/**
 * Chat-draft endpoint used by the Chat channel as a REST fallback (the
 * primary path for the live two-window demo is the socket event of the
 * same name, which calls the same aiOrchestrator function).
 */
router.post('/chat-draft', async (req, res) => {
  const { conversationId, customerMessage, productType } = req.body || {};
  if (!conversationId || !customerMessage) {
    return res.status(400).json({ error: 'conversationId and customerMessage are required' });
  }
  const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId);
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });

  try {
    const draft = await orchestrator.getChatDraft({
      customerMessage,
      productType: productType || convo.product_context,
      conversationId,
    });
    await adminAgent.logMessage({ conversationId, sender: 'customer', kind: 'text', content: customerMessage });
    await adminAgent.logMessage({ conversationId, sender: 'ai', kind: 'draft', content: draft.draftReply });
    res.json({ draft });
  } catch (err) {
    console.error('[guidance.routes] /chat-draft error:', err);
    res.status(500).json({ error: 'Failed to generate draft reply' });
  }
});

module.exports = router;
