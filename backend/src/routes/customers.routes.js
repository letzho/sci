const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');
const { buildPortfolioProfile, PRODUCT_LABELS } = require('../services/portfolioService');
const { getPortfolioRecommendations } = require('../services/recommendationService');
const { buildProductFit } = require('../services/productFitService');
const openaiService = require('../services/openaiService');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { agentCanView, agentCanEdit, listCustomersClause } = require('../utils/customerAccess');

const router = express.Router();

const VALID_CLIENT_STATUS = new Set(['current', 'prospect']);

function optionalAgentId(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET).id;
  } catch {
    return null;
  }
}

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
    healthCondition: row.health_condition,
    avatarEmoji: row.avatar_emoji,
    notes: row.notes,
    agentId: row.agent_id || null,
    isDemo: Boolean(row.is_demo),
    clientStatus: row.client_status || 'current',
    policies: policies.map(mapPolicy),
  };
}

async function loadCustomerRow(id) {
  return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
}

async function loadCustomerMapped(id) {
  const customer = await loadCustomerRow(id);
  if (!customer) return null;
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(id);
  return mapCustomer(customer, policies);
}

function assertCanView(req, res, customer) {
  const agentId = optionalAgentId(req);
  if (!agentCanView(customer, agentId)) {
    res.status(agentId ? 403 : 404).json({ error: agentId ? 'Not authorized for this client' : 'Customer not found' });
    return false;
  }
  return true;
}

function parseCustomerBody(body) {
  const name = String(body?.name || '').trim();
  const clientStatus = VALID_CLIENT_STATUS.has(body?.clientStatus) ? body.clientStatus : 'current';
  return {
    name,
    email: String(body?.email || '').trim() || null,
    phone: String(body?.phone || '').trim() || null,
    dob: String(body?.dob || '').trim() || null,
    healthCondition: String(body?.healthCondition || '').trim() || null,
    notes: String(body?.notes || '').trim() || null,
    avatarEmoji: String(body?.avatarEmoji || '🙂').trim() || '🙂',
    clientStatus,
  };
}

router.get('/', async (req, res) => {
  const agentId = optionalAgentId(req);
  const { sql, params } = listCustomersClause(agentId);
  const customers = await db.prepare(`SELECT * FROM customers ${sql} ORDER BY is_demo DESC, created_at ASC`).all(...params);
  const policyStmt = db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`);
  const result = [];
  for (const c of customers) {
    result.push(mapCustomer(c, await policyStmt.all(c.id)));
  }
  res.json({ customers: result });
});

router.post('/', requireAuth, async (req, res) => {
  const fields = parseCustomerBody(req.body);
  if (!fields.name) return res.status(400).json({ error: 'Name is required' });

  const id = genId('cust');
  await db
    .prepare(
      `INSERT INTO customers (id, name, email, phone, dob, avatar_emoji, notes, health_condition, agent_id, is_demo, client_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      id,
      fields.name,
      fields.email,
      fields.phone,
      fields.dob,
      fields.avatarEmoji,
      fields.notes,
      fields.healthCondition,
      req.agent.id,
      fields.clientStatus
    );

  const customer = await loadCustomerMapped(id);
  res.status(201).json({ customer });
});

router.put('/:id', requireAuth, async (req, res) => {
  const existing = await loadCustomerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  if (!agentCanEdit(existing, req.agent.id)) {
    return res.status(403).json({ error: 'Demo clients cannot be edited — add your own client instead' });
  }

  const fields = parseCustomerBody(req.body);
  if (!fields.name) return res.status(400).json({ error: 'Name is required' });

  await db
    .prepare(
      `UPDATE customers SET name = ?, email = ?, phone = ?, dob = ?, avatar_emoji = ?, notes = ?, health_condition = ?, client_status = ? WHERE id = ?`
    )
    .run(
      fields.name,
      fields.email,
      fields.phone,
      fields.dob,
      fields.avatarEmoji,
      fields.notes,
      fields.healthCondition,
      fields.clientStatus,
      req.params.id
    );

  const customer = await loadCustomerMapped(req.params.id);
  res.json({ customer });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const existing = await loadCustomerRow(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  if (!agentCanEdit(existing, req.agent.id)) {
    return res.status(403).json({ error: 'Demo clients cannot be deleted' });
  }

  await db.prepare(`DELETE FROM customers WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

router.get('/:id/profile', async (req, res) => {
  const customer = await loadCustomerRow(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!assertCanView(req, res, customer)) return;

  const mapped = await loadCustomerMapped(customer.id);
  const portfolio = buildPortfolioProfile(mapped, mapped.policies);
  res.json({ customer: mapped, portfolio });
});

router.post('/:id/recommendations', async (req, res) => {
  const customer = await loadCustomerRow(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!assertCanView(req, res, customer)) return;

  const mapped = await loadCustomerMapped(customer.id);
  const result = await getPortfolioRecommendations(mapped, mapped.policies);
  res.json({
    customer: mapped,
    recommendations: result.recommendations,
    summary: result.summary || null,
    portfolio: result.portfolio,
    disclaimer: result.disclaimer,
    source: result.source,
  });
});

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

function buildDeterministicBrief({ customer, portfolio, sessionCount, lastSessionAgo, discussedTopics }) {
  const firstName = customer.name.split(' ')[0];
  const gaps = portfolio.coverageGaps || [];
  const held = (portfolio.heldProductTypes || []).map((t) => PRODUCT_LABELS[t] || t);
  const isProspect = customer.clientStatus === 'prospect';

  const summaryParts = [];
  summaryParts.push(`${customer.name}${portfolio.age != null ? `, ${portfolio.age}` : ''}${portfolio.healthCondition ? ` — noted health: ${portfolio.healthCondition}` : ''}.`);
  if (isProspect) {
    summaryParts.push('Potential prospect — not yet a policyholder on file.');
  } else if (held.length) {
    summaryParts.push(`Holds ${held.join(', ')}.`);
  } else {
    summaryParts.push('Current client with no policies on file yet.');
  }
  if (customer.notes) summaryParts.push(`Rep notes: ${customer.notes}`);
  summaryParts.push(sessionCount > 0 ? `${sessionCount} prior session${sessionCount === 1 ? '' : 's'}${lastSessionAgo ? `, last ${lastSessionAgo}` : ''}.` : 'First recorded interaction.');

  return {
    summary: summaryParts.join(' '),
    talkingPoints: isProspect
      ? [
          customer.notes ? `Prospect context: ${customer.notes}` : 'Understand their protection and savings priorities before suggesting any product category.',
          'Explore what they already know about insurance and what prompted this conversation.',
        ]
      : gaps.map((g) => `Area to discuss: ${g.label} — ${g.reason}`).slice(0, 4),
    icebreakers: isProspect
      ? [
          `Ask ${firstName} what prompted them to explore financial protection or planning now.`,
          `Find out what ${firstName} already has in place (employer cover, MediShield, savings) before going into product detail.`,
        ]
      : [
          `Ask ${firstName} how things have been since you last spoke.`,
          sessionCount > 0 ? `Reference their existing ${held[0] || 'coverage'} and check if anything has changed.` : `Since this is an early conversation, start by understanding ${firstName}'s priorities.`,
        ],
    suggestedQuestions: isProspect
      ? [
          'What financial goals or worries are top of mind for you right now?',
          'Have you looked at any protection or savings options before — what did you like or dislike?',
          'Who else would be affected if something happened to your income or health?',
        ]
      : [
          'Have there been any changes in your family or work situation recently?',
          'What matters most to you when it comes to financial protection right now?',
          'Is there anything about your current coverage you have been wondering about?',
        ],
    watchOuts: [
      portfolio.healthCondition ? `Be sensitive around the noted health condition (${portfolio.healthCondition}).` : null,
      discussedTopics.length ? `Already discussed before: ${discussedTopics.slice(0, 3).join(', ')}.` : null,
      isProspect ? 'Prospect — explain product categories neutrally; do not recommend or pressure.' : null,
    ].filter(Boolean),
  };
}

router.get('/:id/brief', async (req, res) => {
  const customer = await loadCustomerRow(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!assertCanView(req, res, customer)) return;

  const mapped = await loadCustomerMapped(customer.id);
  const portfolio = buildPortfolioProfile(mapped, mapped.policies);

  const conversations = await db
    .prepare(`SELECT * FROM conversations WHERE customer_id = ? ORDER BY started_at DESC`)
    .all(customer.id);
  const sessionCount = conversations.length;
  const lastSessionAgo = sessionCount ? timeAgo(conversations[0].started_at) : null;
  const channelsUsed = [...new Set(conversations.map((c) => c.channel))];

  const guidanceRows = conversations.length
    ? await db
        .prepare(
          `SELECT title, product_type FROM guidance_events
           WHERE conversation_id IN (SELECT id FROM conversations WHERE customer_id = ?)
             AND guidance_type = 'talking_point' AND title IS NOT NULL
           ORDER BY created_at DESC LIMIT 40`
        )
        .all(customer.id)
    : [];
  const discussedTopics = [...new Set(guidanceRows.map((g) => g.title).filter(Boolean))];

  const recentMessages = conversations.length
    ? await db
        .prepare(
          `SELECT sender, content FROM messages
           WHERE conversation_id IN (SELECT id FROM conversations WHERE customer_id = ?)
             AND sender = 'customer'
           ORDER BY created_at DESC LIMIT 12`
        )
        .all(customer.id)
    : [];

  const upcoming = await db
    .prepare(
      `SELECT scheduled_at, channel, title FROM appointments
       WHERE customer_id = ? AND status = 'scheduled' AND scheduled_at >= ${db.NOW_EXPR}
       ORDER BY scheduled_at ASC LIMIT 3`
    )
    .all(customer.id);

  const meta = {
    sessionCount,
    lastSessionAgo,
    channelsUsed,
    discussedTopics,
    upcomingAppointments: upcoming.map((a) => ({ scheduledAt: a.scheduled_at, channel: a.channel, title: a.title })),
    coverageGaps: portfolio.coverageGaps,
    heldProducts: (portfolio.heldProductTypes || []).map((t) => PRODUCT_LABELS[t] || t),
    age: portfolio.age,
    healthCondition: portfolio.healthCondition,
    totalAnnualPremium: portfolio.totalAnnualPremium,
    totalSumAssured: portfolio.totalSumAssured,
    clientStatus: mapped.clientStatus,
    isProspect: mapped.clientStatus === 'prospect',
  };

  const profileText = [
    `Customer: ${customer.name}`,
    mapped.clientStatus === 'prospect' ? 'Status: Potential prospect (not yet a policyholder)' : 'Status: Current client',
    portfolio.age != null ? `Age: ${portfolio.age}` : null,
    portfolio.healthCondition ? `Health noted: ${portfolio.healthCondition}` : null,
    customer.notes ? `Rep notes / context for this meeting: ${customer.notes}` : null,
    customer.phone ? `Phone: ${customer.phone}` : null,
    customer.email ? `Email: ${customer.email}` : null,
    `Policies held: ${meta.heldProducts.join(', ') || 'none'}`,
    mapped.clientStatus !== 'prospect'
      ? `Total annual premium on file: S$${portfolio.totalAnnualPremium.toLocaleString('en-SG')}; total sum assured: S$${portfolio.totalSumAssured.toLocaleString('en-SG')}`
      : null,
    mapped.clientStatus !== 'prospect'
      ? `Coverage gaps (neutral, for discussion only): ${(portfolio.coverageGaps || []).map((g) => `${g.label} (${g.reason})`).join('; ') || 'none detected'}`
      : 'Focus on discovery: understand needs and priorities before discussing specific products.',
    `Prior sessions: ${sessionCount}${lastSessionAgo ? ` (last ${lastSessionAgo})` : ''}; channels: ${channelsUsed.join(', ') || 'none'}`,
    discussedTopics.length ? `Topics already explained in past sessions: ${discussedTopics.slice(0, 8).join('; ')}` : null,
    recentMessages.length ? `Recent things the customer said: ${recentMessages.map((m) => `"${m.content.slice(0, 120)}"`).join(' ')}` : null,
    upcoming.length ? `Upcoming appointment: ${upcoming[0].scheduled_at}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  let brief = await openaiService.generateClientBrief({ profileText });
  let source = 'ai';
  if (!brief) {
    brief = buildDeterministicBrief({ customer: mapped, portfolio, sessionCount, lastSessionAgo, discussedTopics });
    source = 'deterministic';
  }

  res.json({ customer: mapped, portfolio, meta, brief, source });
});

router.get('/:id/product-fit', async (req, res) => {
  const customer = await loadCustomerRow(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!assertCanView(req, res, customer)) return;

  const mapped = await loadCustomerMapped(customer.id);
  const selectedNeeds = (req.query.needs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const fit = buildProductFit(mapped, mapped.policies, selectedNeeds);
  res.json(fit);
});

router.get('/:id', async (req, res) => {
  const customer = await loadCustomerRow(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  if (!assertCanView(req, res, customer)) return;

  const mapped = await loadCustomerMapped(customer.id);
  res.json({ customer: mapped });
});

module.exports = router;
