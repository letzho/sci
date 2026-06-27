const express = require('express');
const multer = require('multer');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const documentService = require('../services/documentService');
const interpreterAgent = require('../agents/interpreterAgent');
const { inferDocumentProductType } = require('../services/policyContext');
const adminAgent = require('../agents/adminAgent');

const router = express.Router();

/**
 * Customer-facing policy upload: "share my policy with my representative",
 * from the Client Portal chat screen (frontend/src/pages/client/
 * ClientChat.jsx). Intentionally public/unauthenticated - no requireAuth -
 * matching every other customer-facing route in this app (see
 * backend/src/middleware/auth.js / README: the Client Portal simulates a
 * customer already inside their own authenticated app).
 *
 * Memory storage only, same pattern as backend/src/routes/documents.routes.js:
 * the raw PDF is parsed straight to text and never written to disk.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported'));
    }
  },
});

function mapUpload(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    filename: row.filename,
    pageCount: row.page_count,
    status: row.status,
    error: row.error,
    analysis: row.analysis_json ? JSON.parse(row.analysis_json) : null,
    createdAt: row.created_at,
  };
}

/**
 * Uploads a policy PDF, extracts its text (documentService.extractText -
 * the same parser used for agent-uploaded reference PDFs), runs it through
 * the Interpreter Agent, persists everything, then both records a
 * 'policy_document' message (so it shows up in conversation history) and
 * pushes a 'policy-shared' Socket.io event to the conversation room so the
 * representative's ChatReview screen updates live, the same way 'chat-draft'
 * already does for AI-drafted replies (backend/src/sockets/index.js).
 */
router.post('/', (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });

    const { conversationId } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required' });

    const convo = await db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(conversationId);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const uploadId = genId('pu');
    await db.prepare(`INSERT INTO policy_uploads (id, conversation_id, filename, status) VALUES (?, ?, ?, 'processing')`).run(
      uploadId,
      conversationId,
      req.file.originalname
    );

    try {
      const { text, pageCount } = await documentService.extractText(req.file.buffer);

      if (!text || !text.trim()) {
        await db.prepare(`UPDATE policy_uploads SET status = 'failed', error = ?, page_count = ? WHERE id = ?`).run(
          'No extractable text found - the PDF may be scanned/image-only.',
          pageCount,
          uploadId
        );
      } else {
        const docProductType = inferDocumentProductType(req.file.originalname, null) || convo.product_context;
        const analysis = await interpreterAgent.analyzePolicyText({ text, productType: docProductType });
        await db.prepare(
          `UPDATE policy_uploads SET status = 'analyzed', page_count = ?, extracted_text = ?, analysis_json = ? WHERE id = ?`
        ).run(pageCount, text, JSON.stringify(analysis), uploadId);
      }
    } catch (procErr) {
      console.error('[policyUploads.routes] processing failed:', procErr);
      await db.prepare(`UPDATE policy_uploads SET status = 'failed', error = ? WHERE id = ?`).run(
        String(procErr && procErr.message ? procErr.message : procErr),
        uploadId
      );
    }

    const uploadRow = await db.prepare(`SELECT * FROM policy_uploads WHERE id = ?`).get(uploadId);
    const mapped = mapUpload(uploadRow);

    const message = await adminAgent.logMessage({
      conversationId,
      sender: 'customer',
      kind: 'policy_document',
      content: JSON.stringify({
        uploadId: mapped.id,
        filename: mapped.filename,
        pageCount: mapped.pageCount,
        status: mapped.status,
        error: mapped.error,
        analysis: mapped.analysis,
      }),
    });

    const messagePayload = { id: message.id, sender: message.sender, kind: message.kind, content: message.content, createdAt: message.created_at };

    const io = req.app.get('io');
    if (io) {
      io.to(conversationId).emit('policy-shared', { message: messagePayload });
    }

    res.status(201).json({ upload: mapped, message: messagePayload });
  });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM policy_uploads WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Upload not found' });
  res.json({ upload: mapUpload(row) });
});

module.exports = router;
