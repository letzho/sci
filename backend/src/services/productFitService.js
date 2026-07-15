const { buildPortfolioProfile } = require('./portfolioService');
const { PRODUCTS, NEEDS, getProduct } = require('../data/productKnowledge');

/**
 * Product Fit Guide (compliance-safe, deterministic)
 * --------------------------------------------------
 * Maps a customer's NEEDS (either explicitly selected by the rep / captured
 * from the needs survey, or inferred from their profile gaps) to the product
 * CATEGORY that addresses each need, with plain-English talking points for the
 * representative. It never tells the customer what to buy — it equips the rep
 * to explain the options and decide together with the customer.
 */

const ALL_NEED_KEYS = Object.keys(NEEDS);

function buildNeedCard(needKey, heldSet, portfolio) {
  const need = NEEDS[needKey];
  if (!need) return null;
  const product = getProduct(need.productType);
  if (!product) return null;

  const held = heldSet.has(product.productType);
  const isGap = (portfolio.coverageGaps || []).some((g) => g.productType === product.productType);

  return {
    need: { key: need.key, label: need.label },
    product: {
      productType: product.productType,
      label: product.label,
      emoji: product.emoji,
      whatItDoes: product.whatItDoes,
      whyFits: `Addresses "${need.label.toLowerCase()}": ${product.protectsAgainst}`,
      tradeoff: product.guaranteedNote,
      talkingPoints: product.talkingPoints,
      questionsToAsk: product.questionsToAsk,
      held,
      isGap: isGap && !held,
    },
  };
}

/**
 * @param {object} customer  mapped customer (id, name, dob, healthCondition, notes)
 * @param {Array}  policies  the customer's policies
 * @param {Array<string>} selectedNeeds  need keys the rep/survey chose; empty = show all
 */
function buildProductFit(customer, policies, selectedNeeds = []) {
  const portfolio = buildPortfolioProfile(customer, policies);
  const heldSet = new Set(portfolio.heldProductTypes || []);

  const needKeys = selectedNeeds.length
    ? selectedNeeds.filter((k) => NEEDS[k])
    : ALL_NEED_KEYS;

  const cards = needKeys.map((k) => buildNeedCard(k, heldSet, portfolio)).filter(Boolean);

  // Order so the most actionable conversation points come first: coverage
  // gaps, then not-yet-held categories, then things they already have.
  cards.sort((a, b) => {
    const rank = (c) => (c.product.isGap ? 0 : c.product.held ? 2 : 1);
    return rank(a) - rank(b);
  });

  // A short, neutral context line for the rep — never a recommendation.
  const contextBits = [];
  if (portfolio.age != null) contextBits.push(`age ${portfolio.age}`);
  if (portfolio.healthCondition) contextBits.push(`noted health: ${portfolio.healthCondition}`);
  if (heldSet.size) {
    contextBits.push(`already holds ${[...heldSet].map((t) => PRODUCTS[t]?.label || t).join(', ')}`);
  }

  return {
    customerName: customer.name,
    context: contextBits.join(' · '),
    selectedNeeds: needKeys,
    cards,
    disclaimer:
      'A guide for the representative to explain options — not a recommendation to the customer, and not financial advice. The rep and customer decide together.',
  };
}

module.exports = { buildProductFit, ALL_NEED_KEYS };
