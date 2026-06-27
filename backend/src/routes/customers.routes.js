const express = require('express');
const db = require('../db/connection');

const router = express.Router();

/**
 * NOTE on auth scope (demo simplification): customer read endpoints are
 * intentionally public. This app is an internal agent-assist tool; the
 * "Client Portal" simulates what a customer would already see inside their
 * own authenticated app, so for the purposes of this demo it skips a full
 * customer login system and lets you pick a seeded demo profile instead.
 * Agent-side write actions remain behind requireAuth (see conversations/messages routes).
 */

function mapPolicy(row) {
  let coverage = {};
  try {
    coverage = row.coverage_json ? JSON.parse(row.coverage_json) : {};
  } catch (_) {
    coverage = {};
  }
  return {
    id: row.id,
    productType: row.product_type,
    policyNumber: row.policy_number,
    status: row.status,
    premium: row.premium,
    premiumFreq: row.premium_freq,
    nextPaymentDate: row.next_payment_date,
    startDate: row.start_date,
    endDate: row.end_date,
    coverage,
  };
}

function mapCustomer(row, policies) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    dob: row.dob,
    avatarEmoji: row.avatar_emoji,
    notes: row.notes,
    policies: policies.map(mapPolicy),
  };
}

router.get('/', async (req, res) => {
  const customers = await db.prepare(`SELECT * FROM customers ORDER BY created_at ASC`).all();
  const policyStmt = db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`);
  const result = [];
  for (const c of customers) {
    result.push(mapCustomer(c, await policyStmt.all(c.id)));
  }
  res.json({ customers: result });
});

router.get('/:id', async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  res.json({ customer: mapCustomer(customer, policies) });
});

module.exports = router;
