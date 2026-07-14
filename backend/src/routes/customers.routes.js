const express = require('express');
const db = require('../db/connection');
const { buildPortfolioProfile, PRODUCT_LABELS } = require('../services/portfolioService');
const { getPortfolioRecommendations } = require('../services/recommendationService');
const openaiService = require('../services/openaiService');

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
    healthCondition: row.health_condition,
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

router.get('/:id/profile', async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  const mapped = mapCustomer(customer, policies);
  const portfolio = buildPortfolioProfile(mapped, mapped.policies);
  res.json({ customer: mapped, portfolio });
});

router.post('/:id/recommendations', async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  const mapped = mapCustomer(customer, policies);
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

/** Deterministic brief used when OpenAI is off — assembled from portfolio + history. */
function buildDeterministicBrief({ customer, portfolio, sessionCount, lastSessionAgo, discussedTopics }) {
  const firstName = customer.name.split(' ')[0];
  const gaps = portfolio.coverageGaps || [];
  const held = (portfolio.heldProductTypes || []).map((t) => PRODUCT_LABELS[t] || t);

  const summaryParts = [];
  summaryParts.push(`${customer.name}${portfolio.age != null ? `, ${portfolio.age}` : ''}${portfolio.healthCondition ? ` — noted health: ${portfolio.healthCondition}` : ''}.`);
  summaryParts.push(held.length ? `Holds ${held.join(', ')}.` : 'No policies on file yet.');
  summaryParts.push(sessionCount > 0 ? `${sessionCount} prior session${sessionCount === 1 ? '' : 's'}${lastSessionAgo ? `, last ${lastSessionAgo}` : ''}.` : 'First recorded interaction.');

  return {
    summary: summaryParts.join(' '),
    talkingPoints: gaps.map((g) => `Area to discuss: ${g.label} — ${g.reason}`).slice(0, 4),
    icebreakers: [
      `Ask ${firstName} how things have been since you last spoke.`,
      sessionCount > 0 ? `Reference their existing ${held[0] || 'coverage'} and check if anything has changed.` : `Since this is an early conversation, start by understanding ${firstName}'s priorities.`,
    ],
    suggestedQuestions: [
      'Have there been any changes in your family or work situation recently?',
      'What matters most to you when it comes to financial protection right now?',
      'Is there anything about your current coverage you have been wondering about?',
    ],
    watchOuts: [
      portfolio.healthCondition ? `Be sensitive around the noted health condition (${portfolio.healthCondition}).` : null,
      discussedTopics.length ? `Already discussed before: ${discussedTopics.slice(0, 3).join(', ')}.` : null,
    ].filter(Boolean),
  };
}

/**
 * Pre-call Client Brief: compiles the customer's profile, portfolio, prior
 * sessions and topics already discussed into a compliance-safe briefing the
 * rep can skim before a conversation. AI-enhanced when OPENAI_API_KEY is set,
 * with a deterministic fallback otherwise.
 */
router.get('/:id/brief', async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  const mapped = mapCustomer(customer, policies);
  const portfolio = buildPortfolioProfile(mapped, mapped.policies);

  const conversations = await db
    .prepare(`SELECT * FROM conversations WHERE customer_id = ? ORDER BY started_at DESC`)
    .all(customer.id);
  const sessionCount = conversations.length;
  const lastSessionAgo = sessionCount ? timeAgo(conversations[0].started_at) : null;
  const channelsUsed = [...new Set(conversations.map((c) => c.channel))];

  // Topics already covered: from guidance served + product context of past sessions.
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

  // A few recent customer utterances give the AI conversational context.
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
  };

  // Assemble a compact text context for the AI, then enhance (or fall back).
  const profileText = [
    `Customer: ${customer.name}`,
    portfolio.age != null ? `Age: ${portfolio.age}` : null,
    portfolio.healthCondition ? `Health noted: ${portfolio.healthCondition}` : null,
    customer.notes ? `Rep notes: ${customer.notes}` : null,
    `Policies held: ${meta.heldProducts.join(', ') || 'none'}`,
    `Total annual premium on file: S$${portfolio.totalAnnualPremium.toLocaleString('en-SG')}; total sum assured: S$${portfolio.totalSumAssured.toLocaleString('en-SG')}`,
    `Coverage gaps (neutral, for discussion only): ${(portfolio.coverageGaps || []).map((g) => `${g.label} (${g.reason})`).join('; ') || 'none detected'}`,
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

router.get('/:id', async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  const policies = await db.prepare(`SELECT * FROM policies WHERE customer_id = ? ORDER BY created_at ASC`).all(customer.id);
  res.json({ customer: mapCustomer(customer, policies) });
});

module.exports = router;
