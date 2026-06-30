const PRODUCT_LABELS = {
  life_insurance: 'Life insurance',
  ilp: 'Investment-linked policy',
  critical_illness: 'Critical illness',
  integrated_shield_plan: 'Integrated Shield Plan',
  retirement_cpf: 'Retirement / CPF LIFE',
};

const PRODUCT_COLORS = {
  life_insurance: '#2563eb',
  ilp: '#7c3aed',
  critical_illness: '#dc2626',
  integrated_shield_plan: '#059669',
  retirement_cpf: '#d97706',
};

const CORE_PRODUCT_TYPES = [
  'life_insurance',
  'critical_illness',
  'integrated_shield_plan',
  'retirement_cpf',
  'ilp',
];

function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function annualPremium(premium, freq) {
  const p = Number(premium) || 0;
  if (!p) return 0;
  const f = (freq || 'monthly').toLowerCase();
  if (f === 'annual' || f === 'yearly') return p;
  if (f === 'quarterly') return p * 4;
  if (f === 'n/a') return 0;
  return p * 12;
}

function sumAssuredFromPolicy(policy) {
  const cov = policy.coverage || {};
  return Number(cov.sumAssured) || 0;
}

/**
 * Build pie-chart slices from policies — by annual premium (fallback: count).
 */
function buildPortfolioSlices(policies) {
  const byType = {};
  for (const p of policies || []) {
    const type = p.productType || 'other';
    if (!byType[type]) {
      byType[type] = { productType: type, label: PRODUCT_LABELS[type] || type, annualPremium: 0, policyCount: 0, sumAssured: 0 };
    }
    byType[type].annualPremium += annualPremium(p.premium, p.premiumFreq);
    byType[type].policyCount += 1;
    byType[type].sumAssured += sumAssuredFromPolicy(p);
  }

  const entries = Object.values(byType);
  const totalPremium = entries.reduce((s, e) => s + e.annualPremium, 0);
  const usePremium = totalPremium > 0;

  const slices = entries.map((e) => ({
    productType: e.productType,
    label: e.label,
    value: usePremium ? e.annualPremium : e.policyCount,
    valueLabel: usePremium ? `S$${Math.round(e.annualPremium).toLocaleString('en-SG')}/yr` : `${e.policyCount} policy`,
    policyCount: e.policyCount,
    sumAssured: e.sumAssured,
    color: PRODUCT_COLORS[e.productType] || '#64748b',
  }));

  const total = slices.reduce((s, sl) => s + sl.value, 0);
  return slices.map((sl) => ({
    ...sl,
    percentage: total > 0 ? Math.round((sl.value / total) * 1000) / 10 : 0,
  }));
}

function detectCoverageGaps(policies, age) {
  const held = new Set((policies || []).map((p) => p.productType));
  const gaps = [];

  if (!held.has('life_insurance') && age != null && age < 60) {
    gaps.push({
      productType: 'life_insurance',
      label: PRODUCT_LABELS.life_insurance,
      reason: 'No life cover on file — income protection for dependents is often reviewed first.',
      priority: 'high',
    });
  }
  if (!held.has('integrated_shield_plan')) {
    gaps.push({
      productType: 'integrated_shield_plan',
      label: PRODUCT_LABELS.integrated_shield_plan,
      reason: 'No hospitalisation / Shield plan — Medisave can offset premiums for Singapore residents.',
      priority: 'high',
    });
  }
  if (!held.has('critical_illness') && age != null && age >= 30) {
    gaps.push({
      productType: 'critical_illness',
      label: PRODUCT_LABELS.critical_illness,
      reason: 'No critical illness cover — lump-sum payout can bridge income loss during recovery.',
      priority: age >= 40 ? 'high' : 'medium',
    });
  }
  if (!held.has('retirement_cpf') && !held.has('ilp') && age != null && age >= 35) {
    gaps.push({
      productType: 'retirement_cpf',
      label: PRODUCT_LABELS.retirement_cpf,
      reason: 'No retirement or investment-linked plan — long-term savings may need topping up before payout age.',
      priority: age >= 50 ? 'high' : 'medium',
    });
  }
  if (!held.has('ilp') && held.has('life_insurance') && age != null && age < 45) {
    gaps.push({
      productType: 'ilp',
      label: PRODUCT_LABELS.ilp,
      reason: 'Protection is in place but no growth component — ILP can complement term life for wealth building.',
      priority: 'low',
    });
  }

  return gaps;
}

function buildPortfolioProfile(customer, policies) {
  const age = computeAge(customer.dob);
  const slices = buildPortfolioSlices(policies);
  const totalAnnualPremium = slices.reduce((s, sl) => s + (sl.valueLabel.includes('/yr') ? sl.value : 0), 0);
  const totalSumAssured = policies.reduce((s, p) => s + sumAssuredFromPolicy(p), 0);
  const heldTypes = [...new Set(policies.map((p) => p.productType))];

  return {
    age,
    healthCondition: customer.healthCondition || customer.health_condition || null,
    policyCount: policies.length,
    totalAnnualPremium: Math.round(totalAnnualPremium),
    totalSumAssured,
    heldProductTypes: heldTypes,
    pieChart: { slices, metric: totalAnnualPremium > 0 ? 'annual_premium' : 'policy_count' },
    coverageGaps: detectCoverageGaps(policies, age),
    coreProducts: CORE_PRODUCT_TYPES.map((type) => ({
      productType: type,
      label: PRODUCT_LABELS[type],
      held: heldTypes.includes(type),
    })),
  };
}

module.exports = {
  PRODUCT_LABELS,
  PRODUCT_COLORS,
  computeAge,
  buildPortfolioSlices,
  buildPortfolioProfile,
  detectCoverageGaps,
};
