const openaiService = require('./openaiService');
const { buildPortfolioProfile, PRODUCT_LABELS } = require('./portfolioService');

const AGE_GUIDANCE = [
  { maxAge: 30, focus: ['life_insurance', 'integrated_shield_plan', 'ilp'] },
  { maxAge: 40, focus: ['life_insurance', 'critical_illness', 'integrated_shield_plan', 'ilp'] },
  { maxAge: 50, focus: ['critical_illness', 'life_insurance', 'integrated_shield_plan', 'retirement_cpf'] },
  { maxAge: 65, focus: ['retirement_cpf', 'critical_illness', 'integrated_shield_plan', 'life_insurance'] },
  { maxAge: 120, focus: ['retirement_cpf', 'integrated_shield_plan', 'life_insurance'] },
];

function ruleBasedRecommendations(customer, policies, portfolio) {
  const age = portfolio.age;
  const held = new Set(portfolio.heldProductTypes);
  const ageBand = AGE_GUIDANCE.find((b) => age == null || age <= b.maxAge) || AGE_GUIDANCE[AGE_GUIDANCE.length - 1];
  const health = (customer.healthCondition || customer.health_condition || '').toLowerCase();

  const recommendations = [];

  for (const gap of portfolio.coverageGaps) {
    recommendations.push({
      productType: gap.productType,
      label: gap.label,
      priority: gap.priority,
      reason: gap.reason,
      source: 'rule_engine',
    });
  }

  for (const type of ageBand.focus) {
    if (held.has(type)) continue;
    if (recommendations.some((r) => r.productType === type)) continue;
    recommendations.push({
      productType: type,
      label: PRODUCT_LABELS[type],
      priority: 'medium',
      reason: `At age ${age ?? 'your current stage'}, many clients review ${PRODUCT_LABELS[type]} alongside existing cover.`,
      source: 'rule_engine',
    });
  }

  if (/diabet|hypertens|heart|cholesterol|smok/.test(health)) {
    if (!held.has('critical_illness')) {
      const existing = recommendations.find((r) => r.productType === 'critical_illness');
      if (existing) {
        existing.priority = 'high';
        existing.reason =
          'Given your noted health condition, critical illness cover is often discussed for lump-sum protection during recovery.';
      }
    }
    if (!held.has('integrated_shield_plan')) {
      const isp = recommendations.find((r) => r.productType === 'integrated_shield_plan');
      if (isp) {
        isp.priority = 'high';
        isp.reason = 'Hospitalisation cover (Shield plan) helps manage inpatient costs — especially worth reviewing with pre-existing conditions.';
      }
    }
  }

  const enhance = [];
  for (const p of policies) {
    const sa = Number(p.coverage?.sumAssured) || 0;
    if (p.productType === 'life_insurance' && sa > 0 && sa < 300000 && age != null && age < 55) {
      enhance.push({
        productType: 'life_insurance',
        label: PRODUCT_LABELS.life_insurance,
        priority: 'medium',
        reason: `Current life sum assured is S$${sa.toLocaleString('en-SG')} — you may wish to review whether this matches your income-replacement needs.`,
        source: 'rule_engine',
        action: 'enhance',
      });
    }
    if (p.productType === 'critical_illness' && sa > 0 && sa < 200000) {
      enhance.push({
        productType: 'critical_illness',
        label: PRODUCT_LABELS.critical_illness,
        priority: 'medium',
        reason: `Critical illness cover at S$${sa.toLocaleString('en-SG')} — consider whether this is enough for treatment and income gap.`,
        source: 'rule_engine',
        action: 'enhance',
      });
    }
  }

  return {
    recommendations: [...recommendations, ...enhance].slice(0, 6),
    disclaimer:
      'General educational pointers only — not personalised financial advice. Your representative can walk through options suited to your situation.',
    source: 'rule_engine',
  };
}

async function getPortfolioRecommendations(customer, policies) {
  const portfolio = buildPortfolioProfile(customer, policies);
  const ruleResult = ruleBasedRecommendations(customer, policies, portfolio);

  if (!openaiService.isEnabled()) {
    return { ...ruleResult, portfolio };
  }

  const aiRecs = await openaiService.generatePortfolioRecommendations({
    customer,
    policies,
    portfolio,
    ruleRecommendations: ruleResult.recommendations,
  });

  if (aiRecs?.recommendations?.length) {
    return {
      recommendations: aiRecs.recommendations,
      summary: aiRecs.summary,
      disclaimer: ruleResult.disclaimer,
      source: 'rule_engine+openai',
      portfolio,
    };
  }

  return { ...ruleResult, portfolio };
}

module.exports = { ruleBasedRecommendations, getPortfolioRecommendations };
