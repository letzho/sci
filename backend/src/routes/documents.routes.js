const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const documentService = require('../services/documentService');

const router = express.Router();

/**
 * Agent-uploaded reference PDFs ("teach the Knowledge Agent"). Memory
 * storage only - the file is parsed straight to text and the raw PDF is
 * never written to disk, so there's nothing extra to clean up or secure.
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

router.get('/', requireAuth, async (req, res) => {
  const { productType } = req.query;
  res.json({
    documents: await documentService.listDocuments({
      productType: productType || undefined,
      agentId: req.agent.id,
    }),
  });
});

router.post('/', requireAuth, (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });

    const productType = req.body.productType || null;
    try {
      const document = await documentService.ingestDocument({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        productType,
        agentId: req.agent?.id || null,
      });
      res.status(201).json({ document });
    } catch (ingestErr) {
      console.error('[documents.routes] ingest failed:', ingestErr);
      res.status(500).json({ error: 'Failed to process PDF' });
    }
  });
});

/**
 * "Teach" the Knowledge Agent from a pasted URL instead of a PDF (e.g. an
 * insurer's public product page, or a CPF/MAS guidance page). JSON body,
 * not multipart - no file involved, so no multer here. Mirrors POST '/'
 * above: fetches + chunks + (if OPENAI_API_KEY is set) embeds the content,
 * always resolving to a document row even on failure (status: 'failed').
 */
router.post('/url', requireAuth, async (req, res) => {
  const { url, productType } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    return res.status(400).json({ error: 'A valid http(s) URL is required' });
  }

  try {
    const document = await documentService.ingestUrl({
      url: url.trim(),
      productType: productType || null,
      agentId: req.agent?.id || null,
    });
    res.status(201).json({ document });
  } catch (ingestErr) {
    console.error('[documents.routes] URL ingest failed:', ingestErr);
    res.status(500).json({ error: 'Failed to process URL' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const deleted = await documentService.deleteDocument(req.params.id, req.agent.id);
  if (!deleted) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true });
});

module.exports = router;
