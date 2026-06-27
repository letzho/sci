/**
 * Barrel file for the agent pipeline:
 *
 *   Orchestrator (coordinator)
 *     -> NLU Agent          intent + product detection
 *     -> Knowledge Agent    approved talking-point retrieval
 *     -> Compliance Agent   risky-phrase flagging
 *     -> Drafting Agent     plain-English / chat reply generation
 *     -> Admin Agent        persistence + metrics
 *
 *   Interpreter Agent       analyzes a customer-uploaded policy PDF for the
 *                           rep's ChatReview screen (backend/src/routes/
 *                           policyUploads.routes.js calls it directly - it
 *                           isn't part of the Orchestrator's two flows above)
 *
 * Import this file when you want access to every agent at once (e.g. for a
 * diagram/demo or a script); routes/sockets generally only need
 * `orchestrator` and `adminAgent` directly.
 */

const orchestrator = require('./orchestrator');
const nluAgent = require('./nluAgent');
const knowledgeAgent = require('./knowledgeAgent');
const complianceAgent = require('./complianceAgent');
const draftingAgent = require('./draftingAgent');
const adminAgent = require('./adminAgent');
const interpreterAgent = require('./interpreterAgent');

module.exports = { orchestrator, nluAgent, knowledgeAgent, complianceAgent, draftingAgent, adminAgent, interpreterAgent };
