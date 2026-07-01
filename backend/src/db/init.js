const db = require('./connection');

/**
 * Adds `column` to `table` if it isn't already there. Postgres (9.6+)
 * supports `ADD COLUMN IF NOT EXISTS` natively, so unlike the old SQLite
 * version of this file there's no need to check `information_schema` first -
 * this is just a thin, named wrapper for readability at the call sites
 * below.
 */
async function ensureColumn(table, column, definitionSql) {
  await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definitionSql}`);
}

/**
 * Creates all tables if they do not already exist. Schema is plain,
 * portable SQL - TEXT primary keys (app-generated via genId(), not
 * SERIAL/AUTOINCREMENT) and TEXT timestamp columns, so this reads almost
 * identically to the original SQLite version. The two real dialect
 * differences are `datetime('now')` -> db.NOW_EXPR, and SQLite's implicit
 * `CREATE TABLE IF NOT EXISTS` ALTER workaround -> Postgres's native
 * `ADD COLUMN IF NOT EXISTS` (see ensureColumn above).
 */
async function initSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent',
      avatar_emoji TEXT DEFAULT '🧑‍💼',
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      dob TEXT,
      avatar_emoji TEXT DEFAULT '🙂',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_type TEXT NOT NULL,
      policy_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      premium REAL,
      premium_freq TEXT DEFAULT 'monthly',
      next_payment_date TEXT,
      start_date TEXT,
      end_date TEXT,
      coverage_json TEXT,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      channel TEXT NOT NULL CHECK (channel IN ('face_to_face','virtual_call','chat')),
      product_context TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR}),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('agent','customer','ai')),
      kind TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS guidance_events (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      trigger_text TEXT,
      guidance_type TEXT NOT NULL CHECK (guidance_type IN ('talking_point','compliance_flag','explainer')),
      product_type TEXT,
      title TEXT,
      content TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      source TEXT DEFAULT 'rule_engine',
      accepted INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      product_type TEXT NOT NULL,
      topic TEXT NOT NULL,
      keywords TEXT NOT NULL,
      approved_message TEXT NOT NULL,
      plain_english TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS compliance_rules (
      id TEXT PRIMARY KEY,
      flagged_phrase TEXT NOT NULL,
      product_type TEXT,
      severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high','medium','low')),
      reason TEXT NOT NULL,
      suggested_replacement TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    -- Agent-uploaded reference PDFs (e.g. product summaries/fact sheets).
    -- Lets a rep "teach" the Knowledge Agent new material without a code
    -- change: the file is parsed, chunked, and the chunks become an
    -- additional (clearly-labelled, non-pre-approved) source the AI can
    -- ground chat drafts and live guidance in, alongside the curated
    -- knowledge_base. product_type = NULL means "general", matched
    -- regardless of the active session's product context.
    CREATE TABLE IF NOT EXISTS learned_documents (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id),
      product_type TEXT,
      filename TEXT NOT NULL,
      title TEXT,
      page_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','active','failed')),
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE TABLE IF NOT EXISTS learned_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES learned_documents(id) ON DELETE CASCADE,
      product_type TEXT,
      topic TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    -- Customer-uploaded policy PDFs, shared from the Client Portal chat
    -- screen so a representative can review them inside ChatReview. The
    -- Interpreter Agent (backend/src/agents/interpreterAgent.js) writes its
    -- analysis here as analysis_json once processing completes; status
    -- mirrors learned_documents above ('processing' -> 'analyzed'|'failed').
    CREATE TABLE IF NOT EXISTS policy_uploads (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      page_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','analyzed','failed')),
      error TEXT,
      extracted_text TEXT,
      analysis_json TEXT,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );

    CREATE INDEX IF NOT EXISTS idx_policy_uploads_conv ON policy_uploads(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_policies_customer ON policies(customer_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_guidance_conv ON guidance_events(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_kb_product ON knowledge_base(product_type);
    CREATE INDEX IF NOT EXISTS idx_rules_product ON compliance_rules(product_type);
    CREATE INDEX IF NOT EXISTS idx_learned_docs_product ON learned_documents(product_type);
    CREATE INDEX IF NOT EXISTS idx_learned_chunks_doc ON learned_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_learned_chunks_product ON learned_chunks(product_type);
  `);

  // --- Migrations (existing DBs may predate these columns) ---------------
  // source_type/source_url: a rep can now teach the Knowledge Agent from a
  // pasted URL as well as a PDF (backend/src/services/urlFetchService.js);
  // existing PDF rows default to source_type='pdf' with no source_url.
  await ensureColumn('learned_documents', 'source_type', "TEXT NOT NULL DEFAULT 'pdf'");
  await ensureColumn('learned_documents', 'source_url', 'TEXT');
  // embedding: per-chunk vector (JSON-encoded float array) used for semantic
  // search (backend/src/services/vectorStore.js). NULL until embedded, or
  // forever NULL if OPENAI_API_KEY isn't set - callers must treat it as
  // optional and fall back to the keyword-overlap matcher in ruleEngine.js.
  await ensureColumn('learned_chunks', 'embedding', 'TEXT');
  await ensureColumn('policy_uploads', 'raw_extracted_text', 'TEXT');
  await ensureColumn('customers', 'health_condition', 'TEXT');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS financial_plans (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id),
      plan_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR}),
      updated_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_plans_customer ON financial_plans(customer_id);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS policy_upload_chunks (
      id TEXT PRIMARY KEY,
      upload_id TEXT NOT NULL REFERENCES policy_uploads(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      topic TEXT,
      content TEXT NOT NULL,
      embedding TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_policy_chunks_upload ON policy_upload_chunks(upload_id);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      scheduled_at TEXT NOT NULL,
      channel TEXT DEFAULT 'virtual_call' CHECK (channel IN ('face_to_face','virtual_call','chat')),
      title TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_agent ON appointments(agent_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at);

    CREATE TABLE IF NOT EXISTS agent_blocked_dates (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      block_date TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (${db.NOW_EXPR})
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_agent_date ON agent_blocked_dates(agent_id, block_date);
  `);
}

module.exports = { initSchema };
