const express = require('express');
const multer = require('multer');
const db = require('../db/connection');
const documentService = require('../services/documentService');
const openaiService = require('../services/openaiService');
const policyComparisonService = require('../services/policyComparisonService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_COMPARE_FILES = 8;
const comparisonUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_COMPARE_FILES },
});

/** Saved comparisons for the signed-in agent only. */
router.get('/comparisons', requireAuth, async (req, res) => {
  const comparisons = await policyComparisonService.listComparisons(req.agent.id);
  res.json({ comparisons });
});

router.get('/comparisons/:id', requireAuth, async (req, res) => {
  const comparison = await policyComparisonService.getComparison(req.params.id, req.agent.id);
  if (!comparison) return res.status(404).json({ error: 'Comparison not found' });
  res.json({ comparison });
});

router.delete('/comparisons/:id', requireAuth, async (req, res) => {
  const deleted = await policyComparisonService.deleteComparison(req.params.id, req.agent.id);
  if (!deleted) return res.status(404).json({ error: 'Comparison not found' });
  res.json({ ok: true });
});

/**
 * Drag-drop policy comparison. The rep drops 2-8 policy PDFs (possibly from
 * different insurers); each is parsed to text and the AI returns a normalized,
 * side-by-side comparison table of objective facts — never a recommendation.
 * Results are saved privately for the signed-in agent only.
 */
router.post('/compare', requireAuth, (req, res) => {
  comparisonUpload.array('files', MAX_COMPARE_FILES)(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.message || 'Upload failed' });
    const files = req.files || [];
    if (files.length < 2) return res.status(400).json({ error: 'Upload at least 2 policy documents to compare.' });
    if (!openaiService.isEnabled()) {
      return res.status(503).json({ error: 'AI comparison requires OPENAI_API_KEY on the backend.' });
    }

    try {
      const documents = [];
      const failed = [];
      for (const file of files) {
        try {
          const { text } = await documentService.extractText(file.buffer);
          if (text && text.trim().length > 40) {
            documents.push({ name: file.originalname.replace(/\.pdf$/i, ''), text });
          } else {
            failed.push({ name: file.originalname, reason: 'No readable text (scanned/image PDF?)' });
          }
        } catch (parseErr) {
          failed.push({ name: file.originalname, reason: parseErr.message || 'Could not read file' });
        }
      }

      if (documents.length < 2) {
        return res.status(422).json({
          error: 'Could not read enough documents to compare.',
          failed,
        });
      }

      const comparison = await openaiService.comparePolicyDocuments(documents);
      if (!comparison) return res.status(422).json({ error: 'Could not build a comparison from these documents.' });

      const fileNames = files.map((f) => f.originalname);
      const saved = await policyComparisonService.saveComparison({
        agentId: req.agent.id,
        comparison,
        fileNames,
        failed,
      });

      res.json({ comparison, failed, savedId: saved.id });
    } catch (err) {
      console.error('[policies.routes] /compare error:', err);
      res.status(500).json({ error: 'Comparison failed' });
    }
  });
});

router.get('/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM policies WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Policy not found' });

  let coverage = {};
  try {
    coverage = row.coverage_json ? JSON.parse(row.coverage_json) : {};
  } catch (_) {
    coverage = {};
  }

  const customer = await db.prepare(`SELECT id, name, avatar_emoji FROM customers WHERE id = ?`).get(row.customer_id);

  res.json({
    policy: {
      id: row.id,
      customerId: row.customer_id,
      customerName: customer ? customer.name : null,
      productType: row.product_type,
      policyNumber: row.policy_number,
      status: row.status,
      premium: row.premium,
      premiumFreq: row.premium_freq,
      nextPaymentDate: row.next_payment_date,
      startDate: row.start_date,
      endDate: row.end_date,
      coverage,
    },
  });
});

module.exports = router;
