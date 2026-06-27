const express = require('express');
const adminAgent = require('../agents/adminAgent');
const { computeGamification } = require('../agents/gamification');

const router = express.Router();

/**
 * "Measurable impact" dashboard - computed live from real usage data
 * (conversations, guidance served, compliance flags caught) by the Admin
 * Agent, rather than hard-coded numbers, so the figures genuinely reflect
 * demo/usage activity. Also carries the agent-console gamification layer
 * (level/XP/streak/badges), derived from the same real data, under the
 * `gamification` key so the frontend needs only this one endpoint.
 */
router.get('/', async (req, res) => {
  const [metrics, gamification] = await Promise.all([adminAgent.computeMetrics(), computeGamification()]);
  res.json({ ...metrics, gamification });
});

module.exports = router;
