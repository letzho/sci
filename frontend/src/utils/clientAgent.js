import api from '../api/client';

/**
 * Which representative the Client Portal talks to.
 *
 * By default it's the first-seeded demo agent, but for multi-tester demos a
 * visitor can pick "their" representative on the Client Portal home — the
 * choice is stored locally and appended to /agents/primary so chats and
 * video calls pair with the right account.
 */
const STORAGE_KEY = 'sci_client_agent_id';

export function getChosenAgentId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setChosenAgentId(agentId) {
  try {
    if (agentId) localStorage.setItem(STORAGE_KEY, agentId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Fetch the portal's representative (chosen one if set, else first-seeded). */
export function fetchClientAgent() {
  const agentId = getChosenAgentId();
  return api.get('/agents/primary', { params: agentId ? { agentId } : {} });
}
