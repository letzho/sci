const DEMO_EMAILS = new Set([
  'alex.tan@example.com',
  'mary.lim@example.com',
  'daniel.wong@example.com',
  'priya.nair@example.com',
]);

function isDemoCustomer(row) {
  if (!row) return false;
  return Boolean(row.is_demo) || (!row.agent_id && DEMO_EMAILS.has((row.email || '').toLowerCase()));
}

function agentCanView(row, agentId) {
  if (isDemoCustomer(row)) return true;
  return Boolean(agentId && row.agent_id === agentId);
}

function agentCanEdit(row, agentId) {
  return Boolean(agentId && row.agent_id === agentId && !isDemoCustomer(row));
}

function listCustomersClause(agentId) {
  if (agentId) {
    return {
      sql: `WHERE is_demo = 1 OR agent_id = ?`,
      params: [agentId],
    };
  }
  return { sql: `WHERE is_demo = 1`, params: [] };
}

module.exports = { isDemoCustomer, agentCanView, agentCanEdit, listCustomersClause, DEMO_EMAILS };
