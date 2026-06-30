const express = require('express');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const { requireAuth } = require('../middleware/auth');
const { buildPortfolioProfile } = require('../services/portfolioService');
const { getPortfolioRecommendations } = require('../services/recommendationService');

const router = express.Router();

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
    healthCondition: row.health_condition,
    avatarEmoji: row.avatar_emoji,
    notes: row.notes,
    policies: policies.map(mapPolicy),
  };
}

const DEFAULT_PLAN = () => ({
  goals: [],
  notes: '',
  proposedProducts: [],
  coverageGap: null,
  retirementTarget: null,
  actionItems: [],
});

/** Agent: load saved plan + fresh portfolio snapshot */
router.get('/:customerId/plan', requireAuth, async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  const mapped = mapCustomer(customer, policies);
  const portfolio = buildPortfolioProfile(mapped, mapped.policies);

  const row = await db.prepare(`SELECT * FROM financial_plans WHERE customer_id = ?`).get(customer.id);
  let plan = DEFAULT_PLAN();
  if (row?.plan_json) {
    try {
      plan = { ...plan, ...JSON.parse(row.plan_json) };
    } catch (_) {}
  }

  res.json({
    plan: {
      id: row?.id || null,
      customerId: customer.id,
      agentId: row?.agent_id || req.agent.id,
      ...plan,
      updatedAt: row?.updated_at || null,
    },
    customer: mapped,
    portfolio,
  });
});

/** Agent: save or update financial plan */
router.put('/:customerId/plan', requireAuth, async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const body = req.body?.plan || req.body || {};
  const planData = {
    goals: Array.isArray(body.goals) ? body.goals : [],
    notes: String(body.notes || ''),
    proposedProducts: Array.isArray(body.proposedProducts) ? body.proposedProducts : [],
    coverageGap: body.coverageGap || null,
    retirementTarget: body.retirementTarget || null,
    actionItems: Array.isArray(body.actionItems) ? body.actionItems : [],
  };

  const existing = await db.prepare(`SELECT id FROM financial_plans WHERE customer_id = ?`).get(customer.id);
  const planJson = JSON.stringify(planData);

  if (existing) {
    await db
      .prepare(`UPDATE financial_plans SET plan_json = ?, agent_id = ?, updated_at = ${db.NOW_EXPR} WHERE customer_id = ?`)
      .run(planJson, req.agent.id, customer.id);
    const row = await db.prepare(`SELECT * FROM financial_plans WHERE customer_id = ?`).get(customer.id);
    return res.json({ plan: { id: row.id, customerId: customer.id, agentId: row.agent_id, ...planData, updatedAt: row.updated_at } });
  }

  const id = genId('fp');
  await db
    .prepare(`INSERT INTO financial_plans (id, customer_id, agent_id, plan_json) VALUES (?, ?, ?, ?)`)
    .run(id, customer.id, req.agent.id, planJson);
  const row = await db.prepare(`SELECT * FROM financial_plans WHERE customer_id = ?`).get(customer.id);
  res.json({ plan: { id: row.id, customerId: customer.id, agentId: row.agent_id, ...planData, updatedAt: row.updated_at } });
});

/** Agent: AI suggestions to seed a plan */
router.post('/:customerId/plan/suggest', requireAuth, async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ?`).all(customer.id);
  const mapped = mapCustomer(customer, policies);
  const result = await getPortfolioRecommendations(mapped, mapped.policies);

  const proposedProducts = (result.recommendations || []).map((r) => ({
    productType: r.productType,
    label: r.label,
    priority: r.priority,
    reason: r.reason,
    action: r.action || 'add',
    selected: r.priority === 'high',
  }));

  res.json({
    proposedProducts,
    summary: result.summary || null,
    portfolio: result.portfolio,
    disclaimer: result.disclaimer,
  });
});

module.exports = router;
