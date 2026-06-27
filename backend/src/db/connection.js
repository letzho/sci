const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

/**
 * Postgres connection.
 *
 * Works identically against a local Postgres instance and a Supabase
 * project - Supabase IS Postgres under the hood, so moving from local dev to
 * Supabase later is just swapping DATABASE_URL to Supabase's connection
 * string (Project Settings -> Database -> Connection string). Nothing else
 * in this file, or anywhere else in the backend, needs to change for that.
 *
 * This used to be better-sqlite3, whose API is synchronous
 * (db.prepare(sql).run()/get()/all() return values directly). Postgres
 * access is inherently async (it's a network round trip), so every call
 * site needed `await` added either way - there's no way around that part of
 * the migration. To keep that change as mechanical as possible (and the
 * diff reviewable), this module exposes a small shim shaped like
 * better-sqlite3's API - prepare(sql).run/get/all, plus exec() - so call
 * sites changed from e.g. `db.prepare(sql).get(id)` to
 * `await db.prepare(sql).get(id)` and nothing about the SQL itself.
 *
 * One real dialect difference does leak through: every existing SQL string
 * was written with better-sqlite3's `?` positional placeholders. Postgres
 * uses `$1, $2, ...`. Rather than rewrite every query in the codebase, that
 * conversion happens once, centrally, in toPgSql() below.
 */

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sci_copilot';

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  /supabase\.co|sslmode=require/i.test(connectionString);

// Supabase direct hostnames often resolve to IPv6; Render often cannot reach
// IPv6 (ENETUNREACH). Prefer IPv4 DNS when connecting to Supabase.
const preferIpv4 =
  process.env.DATABASE_IPV4 !== 'false' && /supabase\.co/i.test(connectionString);

const poolConfig = {
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
};

if (preferIpv4) {
  poolConfig.lookup = (hostname, options, callback) => {
    dns.lookup(hostname, { ...(options || {}), family: 4 }, callback);
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  // A dropped idle connection should never crash the whole process -
  // log it and let the pool reconnect on the next query.
  console.error('[db] unexpected Postgres pool error:', err.message);
});

/**
 * Converts every `?` in a SQL string to incrementing `$1, $2, ...`
 * placeholders, in order. Safe here because every call site passes its
 * params positionally in the same order the `?`s appear, exactly as
 * better-sqlite3 required.
 */
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * Builds the prepare(sql).run/get/all shim against whichever query-runner is
 * passed in - the shared pool for normal calls, or a single checked-out
 * client when running inside withTransaction() below.
 */
function makeShim(runner) {
  return function prepare(sql) {
    const pgSql = toPgSql(sql);
    return {
      /** INSERT/UPDATE/DELETE. Mirrors better-sqlite3's .run() return shape
       * closely enough for this codebase's one use of `.changes`. */
      async run(...params) {
        const res = await runner.query(pgSql, params);
        return { changes: res.rowCount, rows: res.rows };
      },
      /** SELECT expecting at most one row. */
      async get(...params) {
        const res = await runner.query(pgSql, params);
        return res.rows[0];
      },
      /** SELECT expecting any number of rows. */
      async all(...params) {
        const res = await runner.query(pgSql, params);
        return res.rows;
      },
    };
  };
}

const prepare = makeShim(pool);

/**
 * Runs raw, unparameterized SQL - schema DDL (db/init.js) and the demo
 * seed's bulk DELETEs (db/seed.js). Postgres's simple query protocol (used
 * automatically when a query has no parameters) supports multiple
 * semicolon-separated statements in one call, same as better-sqlite3's
 * db.exec(), so those files needed no restructuring beyond `await`.
 */
async function exec(sql) {
  await pool.query(sql);
}

/**
 * Async equivalent of better-sqlite3's synchronous db.transaction(fn): runs
 * `fn` against a single checked-out client wrapped in BEGIN/COMMIT,
 * rolling back on any error. `fn` receives a prepare()-shaped object bound
 * to that one connection, so its queries participate in the transaction
 * instead of going back through the shared pool.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn({ prepare: makeShim(client) });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Postgres expression that mirrors SQLite's `datetime('now')` output format
 * (UTC, "YYYY-MM-DD HH:MM:SS", no timezone suffix) closely enough that
 * sorting/display behavior is unchanged. Used as a literal SQL fragment
 * (not a bound parameter) everywhere the old code wrote `datetime('now')`.
 */
const NOW_EXPR = "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

module.exports = { prepare, exec, withTransaction, pool, NOW_EXPR };
