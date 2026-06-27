/**
 * Deprecated: superseded by the 5-agent pipeline in backend/src/agents/.
 *
 * This file is kept only as a backward-compatible re-export in case
 * anything still imports the old path - nothing in this codebase does
 * anymore (routes/sockets now import backend/src/agents/orchestrator.js and
 * backend/src/agents/adminAgent.js directly). Safe to delete.
 */
module.exports = require('../agents/orchestrator');
