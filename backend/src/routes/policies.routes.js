const express = require('express');
const db = require('../db/connection');

const router = express.Router();

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
