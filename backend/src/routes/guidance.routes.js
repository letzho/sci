const express = require('express');
const multer = require('multer');
const db = require('../db/connection');
const orchestrator = require('../agents/orchestrator');
const adminAgent = require('../agents/adminAgent');
const openaiService = require('../services/openaiService');

const router = express.Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.get('/transcribe/status', (req, res) => {
  res.json({ whisper: openaiService.isEnabled() });
});

/**
 * Live guidance endpoint used by the Face-to-Face channel (single browser
 * tab, agent's mic via OpenAI Whisper (or browser STT fallback). Each
 * transcribed utterance is POSTed here and answered synchronously with talking points + any
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

/**
 * OpenAI Whisper transcription for virtual call / face-to-face channels.
 */
router.post('/transcribe', (req, res) => {
  audioUpload.single('audio')(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'No audio provided' });
    if (!openaiService.isEnabled()) {
      return res.status(503).json({ error: 'Whisper transcription requires OPENAI_API_KEY' });
    }

    try {
      const text = await openaiService.transcribeAudio(req.file.buffer, req.file.originalname || 'audio.webm');
      if (!text) return res.status(422).json({ error: 'Could not transcribe audio' });
      res.json({ text });
    } catch (transcribeErr) {
      console.error('[guidance.routes] /transcribe error:', transcribeErr);
      res.status(500).json({ error: 'Transcription failed' });
    }
  });
});

module.exports = router;
