const express = require('express');
const adminAgent = require('../agents/adminAgent');
const { computeGamification } = require('../agents/gamification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * "Measurable impact" dashboard - computed live from real usage data
 * (conversations, guidance served, compliance flags caught) by the Admin
 * Agent, rather than hard-coded numbers, so the figures genuinely reflect
 * demo/usage activity. Also carries the agent-console gamification layer
 * (level/XP/streak/badges), derived from the same real data, under the
 * `gamification` key so the frontend needs only this one endpoint.
 *
 * Scoped to the logged-in agent so new accounts start at Level 1 / 0 XP.
 */
router.get('/', requireAuth, async (req, res) => {
  const agentId = req.agent.id;
  const [metrics, gamification] = await Promise.all([
    adminAgent.computeMetrics(agentId),
    computeGamification(agentId),
  ]);
  res.json({ ...metrics, gamification });
});

module.exports = router;
