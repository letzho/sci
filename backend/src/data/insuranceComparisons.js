/**
 * Illustrative insurer comparison data for demo purposes.
 * Figures are representative public-market ranges — not live quotes.
 * Used when the knowledge base topic "Comparing insurers" is relevant.
 */

const comparisons = {
  life_insurance: {
    productLabel: 'Term life insurance (S$500k, 20-year, age 35 non-smoker)',
    lastUpdated: '2026-Q2',
    metrics: [
      { key: 'monthlyPremium', label: 'Monthly premium (S$)', format: 'currency', higherIsBetter: false },
      { key: 'claimReputation', label: 'Claims reputation', format: 'score', higherIsBetter: true },
      { key: 'flexibility', label: 'Rider flexibility', format: 'score', higherIsBetter: true },
    ],
    insurers: [
      { id: 'aia', name: 'AIA', monthlyPremium: 42, claimReputation: 92, flexibility: 88, highlight: 'Strong rider ecosystem' },
      { id: 'prudential', name: 'Prudential', monthlyPremium: 45, claimReputation: 90, flexibility: 85, highlight: 'Popular term plans' },
      { id: 'great_eastern', name: 'Great Eastern', monthlyPremium: 40, claimReputation: 87, flexibility: 82, highlight: 'Competitive base premium' },
      { id: 'ntuc_income', name: 'NTUC Income', monthlyPremium: 38, claimReputation: 85, flexibility: 78, highlight: 'Lower entry premium' },
    ],
    disclaimer:
      'Illustrative comparison for discussion only. Actual premiums depend on underwriting, age, health, and sum assured. Not a recommendation to purchase from any insurer.',
  },
  critical_illness: {
    productLabel: 'Critical illness (S$200k, multi-pay, age 35)',
    lastUpdated: '2026-Q2',
    metrics: [
      { key: 'monthlyPremium', label: 'Monthly premium (S$)', format: 'currency', higherIsBetter: false },
      { key: 'conditionsCovered', label: 'Conditions covered', format: 'number', higherIsBetter: true },
      { key: 'earlyStagePayout', label: 'Early-stage payout', format: 'score', higherIsBetter: true },
    ],
    insurers: [
      { id: 'aia', name: 'AIA', monthlyPremium: 95, conditionsCovered: 43, earlyStagePayout: 90, highlight: 'Broad early-stage definitions' },
      { id: 'prudential', name: 'Prudential', monthlyPremium: 98, conditionsCovered: 45, earlyStagePayout: 88, highlight: 'Multi-claim options' },
      { id: 'great_eastern', name: 'Great Eastern', monthlyPremium: 92, conditionsCovered: 41, earlyStagePayout: 85, highlight: 'Competitive CI pricing' },
      { id: 'manulife', name: 'Manulife', monthlyPremium: 88, conditionsCovered: 40, earlyStagePayout: 82, highlight: 'Lower premium tier' },
    ],
    disclaimer:
      'Illustrative comparison for discussion only. Policy definitions and covered conditions vary by contract. Always refer to the policy wording.',
  },
  ilp: {
    productLabel: 'Investment-linked plan (S$500/month, balanced fund)',
    lastUpdated: '2026-Q2',
    metrics: [
      { key: 'fundChoice', label: 'Fund choices', format: 'number', higherIsBetter: true },
      { key: 'managementFee', label: 'Fund mgmt fee (%)', format: 'percent', higherIsBetter: false },
      { key: 'flexibility', label: 'Top-up flexibility', format: 'score', higherIsBetter: true },
    ],
    insurers: [
      { id: 'prudential', name: 'Prudential', fundChoice: 28, managementFee: 1.35, flexibility: 90, highlight: 'Wide fund menu' },
      { id: 'aia', name: 'AIA', fundChoice: 24, managementFee: 1.4, flexibility: 88, highlight: 'Strong digital tools' },
      { id: 'great_eastern', name: 'Great Eastern', fundChoice: 20, managementFee: 1.25, flexibility: 82, highlight: 'Lower fund fees' },
      { id: 'manulife', name: 'Manulife', fundChoice: 18, managementFee: 1.3, flexibility: 80, highlight: 'ESG fund options' },
    ],
    disclaimer:
      'Illustrative comparison for discussion only. Past fund performance is not indicative of future returns. ILP values can go up or down.',
  },
};

function listProductTypes() {
  return Object.keys(comparisons);
}

function getComparison(productType) {
  return comparisons[productType] || null;
}

module.exports = { comparisons, listProductTypes, getComparison };
