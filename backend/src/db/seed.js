/**
 * Seeds the SQLite database with demo data so the app is immediately
 * usable for a presentation: one demo agent, a handful of demo customers
 * with policies across all 5 covered product lines, plus the full
 * knowledge base and compliance rule set.
 *
 * Safe to re-run: it wipes and re-creates rows each time (idempotent demo seed).
 */
const bcrypt = require('bcryptjs');
const db = require('./connection');
const { initSchema } = require('./init');
const { genId } = require('../utils/idGen');
const { knowledgeBase, PRODUCT_TYPES } = require('../data/knowledgeBase');
const { complianceRules } = require('../data/complianceRules');

async function clearAll() {
  // Order matters: a row must be deleted before any row it's referenced by
  // (via a foreign key) gets deleted, unless that FK has ON DELETE CASCADE.
  // learned_documents.agent_id and policy_uploads.conversation_id were added
  // after the original 6 tables below and don't all cascade, so they're
  // cleared explicitly here too - otherwise re-seeding after using the
  // Knowledge Library / policy upload features throws FOREIGN KEY constraint
  // failed on `DELETE FROM agents` / `DELETE FROM conversations`.
    await db.exec(`
    DELETE FROM guidance_events;
    DELETE FROM messages;
    DELETE FROM policy_uploads;
    DELETE FROM financial_plans;
    DELETE FROM appointments;
    DELETE FROM agent_blocked_dates;
    DELETE FROM conversations;
    DELETE FROM learned_chunks;
    DELETE FROM learned_documents;
    DELETE FROM policies;
    DELETE FROM customers;
    DELETE FROM agents;
    DELETE FROM knowledge_base;
    DELETE FROM compliance_rules;
  `);
}

async function seedAgents() {
  const passwordHash = bcrypt.hashSync('demo1234', 10);
  const agents = [
    { id: genId('agent'), name: 'Jamie Lee', email: 'agent@sci.demo', avatar_emoji: '🧑‍💼' },
    { id: genId('agent'), name: 'Wei Ling', email: 'wei.ling@sci.demo', avatar_emoji: '👩‍💼' },
  ];
  const stmt = db.prepare(
    `INSERT INTO agents (id, name, email, password_hash, role, avatar_emoji) VALUES (?, ?, ?, ?, 'agent', ?)`
  );
  for (const a of agents) {
    await stmt.run(a.id, a.name, a.email, passwordHash, a.avatar_emoji);
  }
  return agents;
}

async function seedCustomersAndPolicies() {
  const customers = [
    {
      id: genId('cust'),
      name: 'Alex Tan',
      email: 'alex.tan@example.com',
      phone: '+65 9123 4567',
      dob: '1990-04-12',
      avatar_emoji: '🙂',
      notes: 'Young professional, exploring first protection plan and an ILP for long-term growth.',
      health_condition: 'Generally healthy, non-smoker',
      policies: [
        {
          product_type: PRODUCT_TYPES.LIFE,
          policy_number: 'LIFE-2024-0091',
          status: 'active',
          premium: 88.5,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-10',
          start_date: '2024-07-10',
          end_date: '2044-07-10',
          coverage: { type: 'Term Life', sumAssured: 250000, tpd: true, riders: ['Premium waiver'] },
        },
        {
          product_type: PRODUCT_TYPES.ILP,
          policy_number: 'ILP-2025-0033',
          status: 'active',
          premium: 300,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-05',
          start_date: '2025-01-05',
          end_date: null,
          coverage: { type: 'Investment-Linked Policy', funds: ['Global Equity Fund', 'Balanced Growth Fund'], sumAssured: 100000 },
        },
      ],
    },
    {
      id: genId('cust'),
      name: 'Mary Lim',
      email: 'mary.lim@example.com',
      phone: '+65 9234 5678',
      dob: '1982-11-02',
      avatar_emoji: '👩',
      notes: 'Reviewing critical illness coverage and her Integrated Shield Plan rider before renewal.',
      health_condition: 'Mild hypertension, controlled with medication',
      policies: [
        {
          product_type: PRODUCT_TYPES.CI,
          policy_number: 'CI-2022-0457',
          status: 'active',
          premium: 145,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-18',
          start_date: '2022-07-18',
          end_date: '2052-07-18',
          coverage: { type: 'Critical Illness', sumAssured: 150000, earlyStage: true, conditionsCovered: 37 },
        },
        {
          product_type: PRODUCT_TYPES.ISP,
          policy_number: 'ISP-2021-1182',
          status: 'active',
          premium: 96.2,
          premium_freq: 'monthly',
          next_payment_date: '2026-08-01',
          start_date: '2021-08-01',
          end_date: null,
          coverage: { type: 'Integrated Shield Plan', ward: 'Private', rider: 'As-charged rider', deductible: 2000 },
        },
      ],
    },
    {
      id: genId('cust'),
      name: 'Daniel Wong',
      email: 'daniel.wong@example.com',
      phone: '+65 9345 6789',
      dob: '1968-06-25',
      avatar_emoji: '🧓',
      notes: 'Planning retirement income; comparing CPF LIFE payout options with his whole life policy.',
      health_condition: 'Type 2 diabetes, well-managed',
      policies: [
        {
          product_type: PRODUCT_TYPES.RETIREMENT,
          policy_number: 'CPF-LIFE-STD-7765',
          status: 'active',
          premium: null,
          premium_freq: 'n/a',
          next_payment_date: null,
          start_date: '2033-06-25',
          end_date: null,
          coverage: { type: 'CPF LIFE', plan: 'Standard Plan', payoutStartAge: 65 },
        },
        {
          product_type: PRODUCT_TYPES.LIFE,
          policy_number: 'LIFE-2010-0212',
          status: 'active',
          premium: 210,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-25',
          start_date: '2010-07-25',
          end_date: null,
          coverage: { type: 'Whole Life', sumAssured: 180000, cashValue: 42000 },
        },
      ],
    },
    {
      id: genId('cust'),
      name: 'Priya Nair',
      email: 'priya.nair@example.com',
      phone: '+65 9456 7890',
      dob: '1995-02-18',
      avatar_emoji: '👩‍🦱',
      notes: 'New homeowner, evaluating Integrated Shield Plan upgrade and a starter ILP.',
      policies: [
        {
          product_type: PRODUCT_TYPES.ISP,
          policy_number: 'ISP-2024-2098',
          status: 'active',
          premium: 64.4,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-09',
          start_date: '2024-01-09',
          end_date: null,
          coverage: { type: 'Integrated Shield Plan', ward: 'Public Class A', rider: 'None', deductible: 3500 },
        },
        {
          product_type: PRODUCT_TYPES.ILP,
          policy_number: 'ILP-2026-0117',
          status: 'pending_review',
          premium: 150,
          premium_freq: 'monthly',
          next_payment_date: '2026-07-15',
          start_date: '2026-01-15',
          end_date: null,
          coverage: { type: 'Investment-Linked Policy', funds: ['Conservative Income Fund'], sumAssured: 50000 },
        },
      ],
    },
  ];

  const custStmt = db.prepare(
    `INSERT INTO customers (id, name, email, phone, dob, avatar_emoji, notes, health_condition) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const polStmt = db.prepare(`
    INSERT INTO policies
      (id, customer_id, product_type, policy_number, status, premium, premium_freq, next_payment_date, start_date, end_date, coverage_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of customers) {
    await custStmt.run(c.id, c.name, c.email, c.phone, c.dob, c.avatar_emoji, c.notes, c.health_condition || null);
    for (const p of c.policies) {
      await polStmt.run(
        genId('pol'),
        c.id,
        p.product_type,
        p.policy_number,
        p.status,
        p.premium,
        p.premium_freq,
        p.next_payment_date,
        p.start_date,
        p.end_date,
        JSON.stringify(p.coverage)
      );
    }
  }

  return customers;
}

async function seedKnowledgeBase() {
  const stmt = db.prepare(`
    INSERT INTO knowledge_base (id, product_type, topic, keywords, approved_message, plain_english)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const k of knowledgeBase) {
    await stmt.run(genId('kb'), k.product_type, k.topic, k.keywords, k.approved_message, k.plain_english);
  }
}

async function seedComplianceRules() {
  const stmt = db.prepare(`
    INSERT INTO compliance_rules (id, flagged_phrase, product_type, severity, reason, suggested_replacement)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const r of complianceRules) {
    await stmt.run(genId('rule'), r.flagged_phrase, r.product_type, r.severity, r.reason, r.suggested_replacement);
  }
}

async function run() {
  await initSchema();
  await clearAll();
  const agents = await seedAgents();
  const customers = await seedCustomersAndPolicies();
  await seedKnowledgeBase();
  await seedComplianceRules();

  console.log('Seed complete.');
  console.log('Demo agent login -> email: agent@sci.demo  password: demo1234');
  console.log(`Seeded ${agents.length} agents, ${customers.length} customers, ${knowledgeBase.length} KB entries, ${complianceRules.length} compliance rules.`);
}

if (require.main === module) {
  run()
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exitCode = 1;
    })
    .finally(() => {
      const db2 = require('./connection');
      db2.pool.end();
    });
}

module.exports = { run };
