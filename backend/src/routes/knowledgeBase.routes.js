const express = require('express');
const db = require('../db/connection');

const router = express.Router();

// Powers the "Approved Messaging Library" view - lets a rep browse the
// consistent, pre-approved messaging directly instead of waiting for a
// live trigger. Also doubles as a transparency view for compliance.
router.get('/', async (req, res) => {
  const { productType } = req.query;
  const rows = await (productType
    ? db.prepare(`SELECT * FROM knowledge_base WHERE product_type = ? ORDER BY topic ASC`).all(productType)
    : db.prepare(`SELECT * FROM knowledge_base ORDER BY product_type ASC, topic ASC`).all());

  res.json({
    entries: rows.map((r) => ({
      id: r.id,
      productType: r.product_type,
      topic: r.topic,
      keywords: r.keywords.split(',').map((k) => k.trim()),
      approvedMessage: r.approved_message,
      plainEnglish: r.plain_english,
    })),
  });
});

router.get('/compliance-rules', async (req, res) => {
  const rows = await db.prepare(`SELECT * FROM compliance_rules ORDER BY severity DESC`).all();
  res.json({
    rules: rows.map((r) => ({
      id: r.id,
      flaggedPhrase: r.flagged_phrase,
      productType: r.product_type,
      severity: r.severity,
      reason: r.reason,
      suggestedReplacement: r.suggested_replacement,
    })),
  });
});

module.exports = router;
