const db = require('../db/connection');
const { genId } = require('../utils/idGen');

function mapRow(row) {
  if (!row) return null;
  let comparison = null;
  let fileNames = [];
  let failed = [];
  try {
    comparison = row.comparison_json ? JSON.parse(row.comparison_json) : null;
  } catch {
    comparison = null;
  }
  try {
    fileNames = row.file_names_json ? JSON.parse(row.file_names_json) : [];
  } catch {
    fileNames = [];
  }
  try {
    failed = row.failed_json ? JSON.parse(row.failed_json) : [];
  } catch {
    failed = [];
  }
  return {
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    comparison,
    fileNames,
    failed,
    createdAt: row.created_at,
  };
}

function buildTitle(fileNames) {
  if (!fileNames?.length) return 'Policy comparison';
  const base = fileNames.slice(0, 2).map((n) => n.replace(/\.pdf$/i, '')).join(' vs ');
  if (fileNames.length > 2) return `${base} (+${fileNames.length - 2} more)`;
  return base;
}

async function saveComparison({ agentId, comparison, fileNames, failed }) {
  if (!agentId) throw new Error('agentId is required');
  const id = genId('pcmp');
  const title = buildTitle(fileNames);
  await db
    .prepare(
      `INSERT INTO policy_comparisons (id, agent_id, title, comparison_json, file_names_json, failed_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      agentId,
      title,
      JSON.stringify(comparison),
      JSON.stringify(fileNames || []),
      failed?.length ? JSON.stringify(failed) : null
    );
  return getComparison(id, agentId);
}

async function listComparisons(agentId) {
  if (!agentId) return [];
  const rows = await db
    .prepare(`SELECT * FROM policy_comparisons WHERE agent_id = ? ORDER BY created_at DESC LIMIT 50`)
    .all(agentId);
  return rows.map(mapRow);
}

async function getComparison(id, agentId) {
  if (!agentId) return null;
  const row = await db.prepare(`SELECT * FROM policy_comparisons WHERE id = ? AND agent_id = ?`).get(id, agentId);
  return mapRow(row);
}

async function deleteComparison(id, agentId) {
  if (!agentId) return false;
  const info = await db.prepare(`DELETE FROM policy_comparisons WHERE id = ? AND agent_id = ?`).run(id, agentId);
  return info.changes > 0;
}

module.exports = { saveComparison, listComparisons, getComparison, deleteComparison };
