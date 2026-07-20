const express = require('express');
const { getComparison, listProductTypes } = require('../data/insuranceComparisons');
const { getQuiz } = require('../data/quizQuestions');
const { getFlashcardDeck } = require('../data/gameFlashcards');
const { templates, getTemplate } = require('../data/meetingTemplates');
const quizAgent = require('../agents/quizAgent');
const objectionAgent = require('../agents/objectionAgent');
const simulatorAgent = require('../agents/simulatorAgent');
const complianceAgent = require('../agents/complianceAgent');
const { OBJECTIONS } = require('../data/objectionTypes');
const { PERSONAS } = require('../data/simulatorPersonas');
const researchAgent = require('../agents/researchAgent');
const { predictPremium, checkMlHealth } = require('../services/premiumPredictor');
const { listProducts, PRODUCT_TYPE_COMPARISON, NEEDS } = require('../data/productKnowledge');

const router = express.Router();

/** Product-category reference: the 5 in-scope product types compared side by side (feature B). */
router.get('/product-types', (req, res) => {
  res.json({
    products: listProducts(),
    dimensions: PRODUCT_TYPE_COMPARISON.dimensions,
    disclaimer: PRODUCT_TYPE_COMPARISON.disclaimer,
  });
});

/** The customer-need buckets used by the Product Fit Guide's priority selector. */
router.get('/needs', (req, res) => {
  res.json({ needs: Object.values(NEEDS).map((n) => ({ key: n.key, label: n.label, productType: n.productType })) });
});

/**
 * WebRTC TURN credentials for cross-network video. The Metered secret key
 * stays here on the server (never shipped to the browser bundle); the frontend
 * just asks this endpoint for a ready-to-use iceServers array. Cached briefly
 * to avoid calling Metered on every page load.
 */
let iceCache = { at: 0, servers: null };
const ICE_CACHE_MS = 5 * 60 * 1000;

router.get('/ice-servers', async (req, res) => {
  const domain = process.env.METERED_DOMAIN;
  const apiKey = process.env.METERED_API_KEY;
  if (!domain || !apiKey) return res.json({ iceServers: null });

  if (iceCache.servers && Date.now() - iceCache.at < ICE_CACHE_MS) {
    return res.json({ iceServers: iceCache.servers });
  }

  try {
    const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const r = await fetch(`https://${host}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`);
    if (!r.ok) throw new Error(`Metered HTTP ${r.status}`);
    const servers = await r.json();
    const valid = Array.isArray(servers) && servers.length ? servers : null;
    iceCache = { at: Date.now(), servers: valid };
    res.json({ iceServers: valid });
  } catch (err) {
    console.warn('[tools] ice-servers fetch failed:', err.message);
    res.json({ iceServers: null });
  }
});

const PREMIUM_DISCLAIMER =
  'Illustrative ML estimate only — not financial advice, not underwriting, and not a binding premium quote.';

/** ML premium predictor — proxies to backend/ml Flask service. */
router.get('/premium-predictor/status', async (req, res) => {
  const status = await checkMlHealth();
  res.json(status);
});

router.post('/predict-premium', async (req, res) => {
  try {
    const { premium, inputs } = await predictPremium(req.body);
    res.json({
      mode: 'premium_estimate',
      success: true,
      premium,
      inputs,
      disclaimer: PREMIUM_DISCLAIMER,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** Investment / retirement calculator — runs server-side for consistency when sharing results. */
router.post('/calculate', (req, res) => {
  const { mode, monthlyContribution, annualReturn, years, targetAmount, annualIncome, yearsToReplace, existingCoverage } =
    req.body || {};

  if (mode === 'investment') {
    const r = (Number(annualReturn) || 5) / 100 / 12;
    const n = (Number(years) || 10) * 12;
    const pmt = Number(monthlyContribution) || 500;
    let futureValue = 0;
    if (r === 0) futureValue = pmt * n;
    else futureValue = pmt * ((Math.pow(1 + r, n) - 1) / r);
    const totalContributed = pmt * n;
    return res.json({
      mode: 'investment',
      futureValue: Math.round(futureValue),
      totalContributed: Math.round(totalContributed),
      growth: Math.round(futureValue - totalContributed),
      monthlyContribution: pmt,
      annualReturn: Number(annualReturn) || 5,
      years: Number(years) || 10,
      projection: buildProjection(pmt, r, Math.min(Number(years) || 10, 30)),
    });
  }

  if (mode === 'retirement') {
    const target = Number(targetAmount) || 500000;
    const r = (Number(annualReturn) || 5) / 100 / 12;
    const n = (Number(years) || 20) * 12;
    let requiredMonthly = 0;
    if (r === 0) requiredMonthly = target / n;
    else requiredMonthly = (target * r) / (Math.pow(1 + r, n) - 1);
    return res.json({
      mode: 'retirement',
      targetAmount: target,
      requiredMonthly: Math.round(requiredMonthly),
      annualReturn: Number(annualReturn) || 5,
      years: Number(years) || 20,
    });
  }

  if (mode === 'coverage_gap') {
    const income = Number(annualIncome) || 60000;
    const yrs = Number(yearsToReplace) || 10;
    const existing = Number(existingCoverage) || 0;
    const needed = income * yrs;
    const gap = Math.max(0, needed - existing);
    return res.json({
      mode: 'coverage_gap',
      annualIncome: income,
      yearsToReplace: yrs,
      recommendedCoverage: needed,
      existingCoverage: existing,
      coverageGap: gap,
    });
  }

  res.status(400).json({ error: 'mode must be investment, retirement, or coverage_gap' });
});

function buildProjection(monthly, monthlyRate, years) {
  const points = [];
  let balance = 0;
  for (let y = 0; y <= years; y++) {
    if (y > 0) {
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + monthly;
      }
    }
    points.push({ year: y, balance: Math.round(balance) });
  }
  return points;
}

router.get('/comparisons', (req, res) => {
  const { productType } = req.query;
  if (!productType) {
    return res.json({ productTypes: listProductTypes() });
  }
  const data = getComparison(productType);
  if (!data) return res.status(404).json({ error: 'No comparison data for this product type' });
  res.json({ comparison: data });
});

router.get('/quiz', (req, res) => {
  const { productType } = req.query;
  res.json({ quiz: getQuiz(productType || 'life_insurance') });
});

router.get('/game-flashcards', (req, res) => {
  const { productType } = req.query;
  res.json({ deck: getFlashcardDeck(productType || null) });
});

router.post('/quiz/grade', async (req, res) => {
  const { productType, answers, customerName } = req.body || {};
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'answers object is required' });
  }
  try {
    const grade = await quizAgent.gradeQuiz({ productType, answers, customerName });
    res.json({ grade });
  } catch (err) {
    console.error('[tools] quiz grade error:', err.message);
    res.status(500).json({ error: 'Failed to grade quiz' });
  }
});

router.get('/meeting-templates', (req, res) => {
  res.json({ templates });
});

router.get('/meeting-templates/:id', (req, res) => {
  const template = getTemplate(req.params.id);
  res.json({ template });
});

// ---- Feature 1: Objection Buster Pivot Matrix ----
router.get('/objections', (req, res) => {
  res.json({ objections: OBJECTIONS });
});

router.post('/objection-buster', async (req, res) => {
  const { objectionKey, productType, customerName } = req.body || {};
  try {
    const webResults = await researchAgent.supplement({
      text: `${objectionKey || 'too_expensive'} ${productType || 'life insurance'} Singapore`,
      productType,
      talkingPoints: [],
    });
    const script = await objectionAgent.generatePivotScript({
      objectionKey,
      productType,
      customerName,
      competitiveSnippets: webResults,
    });
    res.json({ script, webResults });
  } catch (err) {
    console.error('[tools] objection-buster error:', err.message);
    res.status(500).json({ error: 'Failed to generate pivot script' });
  }
});

// ---- Feature 2: Flight Simulator Roleplay ----
router.get('/simulator/personas', (req, res) => {
  res.json({ personas: PERSONAS });
});

router.post('/simulator/reply', async (req, res) => {
  const { personaId, turn, agentMessage, productType } = req.body || {};
  try {
    const result = await simulatorAgent.getPersonaReply({ personaId, turn: turn || 0, agentMessage, productType });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Simulator reply failed' });
  }
});

router.post('/simulator/scorecard', async (req, res) => {
  const { personaId, transcript } = req.body || {};
  try {
    const scorecard = await simulatorAgent.scoreSimulation({ personaId, transcript });
    res.json({ scorecard });
  } catch (err) {
    res.status(500).json({ error: 'Scorecard failed' });
  }
});

// ---- Feature 3: Compliance Guard (live check) ----
router.post('/compliance-check', async (req, res) => {
  const { text, productType } = req.body || {};
  if (!text) return res.json({ flags: [] });
  const flags = await complianceAgent.checkCompliance({ text, productType });
  res.json({ flags });
});

// ---- Feature 4: Plain English Infographic ----
router.post('/plain-english-infographic', async (req, res) => {
  const { productType, sourceUrl } = req.body || {};
  const comparison = getComparison(productType || 'life_insurance');
  if (!comparison) return res.status(404).json({ error: 'No data for product type' });

  const premiums = comparison.insurers.map((i) => i.monthlyPremium || i.managementFee || 50);
  const minCost = Math.min(...premiums);
  const maxCost = Math.max(...premiums);
  const avgBenefit = Math.round(
    comparison.insurers.reduce((s, i) => s + (i.claimReputation || i.conditionsCovered || i.fundChoice || 80), 0) /
      comparison.insurers.length
  );

  const infographic = {
    title: comparison.productLabel,
    simplicityScore: Math.min(95, 68 + Math.floor(avgBenefit / 5)),
    costRange: { min: minCost, max: maxCost, unit: comparison.metrics[0]?.format === 'percent' ? '%' : 'S$/mo' },
    benefits: comparison.insurers.slice(0, 3).map((ins) => ({
      label: ins.name,
      value: ins.highlight,
    })),
    plainBullets: [
      `Think of this as choosing between ${comparison.insurers.length} mainstream options — each trades off cost against flexibility.`,
      `The gap between the lowest and highest quoted figure is about ${maxCost - minCost}${comparison.metrics[0]?.format === 'percent' ? ' percentage points' : ' dollars per month'} in our demo data.`,
      `Always match the conversation to the customer's actual policy wording — these figures are for discussion, not a quote.`,
    ],
    sourceUrl: sourceUrl || null,
    disclaimer: comparison.disclaimer,
  };

  res.json({ infographic });
});

module.exports = router;
