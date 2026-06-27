const {
  extractInsuredPlanTier,
  parseBenefitTableByTier,
  reconcileCoverageHighlights,
} = require('./policyTierExtractor');

const sampleText = `
Interest insured
Name ID Number Date of Birth Occupation Relationship to Policyholder Plan
LEOW SENG HEANG S****134F 22 Mar Engineer (Admin) Self Superior with Infectious Disease Coverage

Table of cover
Maximum benefit (S$) per insured person
Benefits Basic Classic Superior Premium Prestige
Section 1 Accidental death $100,000 $200,000 $300,000 $500,000 $1,000,000
Section 3 Permanent disability (per policy year) $150,000 $300,000 $450,000 $750,000 $1,500,000
Section 4 Medical expenses for injury due to an accident (per accident) $2,000 $3,000 $5,000 $10,000 $20,000
`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tier = extractInsuredPlanTier(sampleText);
assert(tier === 'superior', `expected superior, got ${tier}`);

const table = parseBenefitTableByTier(sampleText);
assert(table.accidental_death?.superior === 300000, 'superior accidental death should be 300k');
assert(table.accidental_death?.prestige === 1000000, 'prestige accidental death should be 1M');

const merged = reconcileCoverageHighlights({
  text: sampleText,
  tier: 'superior',
  aiHighlights: ['Accidental death coverage up to S$1,000,000 under your PA Assurance policy.'],
});
assert(
  merged.some((h) => h.includes('300,000') || h.includes('300000')),
  'merged highlights should use Superior tier amount'
);
assert(
  !merged.some((h) => /1,000,000|1000000/.test(h)),
  'merged highlights should not keep Prestige amount'
);

console.log('policyTierExtractor tests passed');
