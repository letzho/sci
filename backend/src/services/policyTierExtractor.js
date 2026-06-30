/**
 * Extracts the customer's enrolled plan tier from policy PDF text and maps
 * multi-column "Table of cover" benefits to that tier only.
 *
 * pdf-parse flattens tables into a single text stream (Basic Classic Superior
 * Premium Prestige … then all dollar amounts in row order). Without tier
 * detection the LLM often picks the highest column (Prestige) by mistake.
 */

const TIER_ORDER = ['basic', 'classic', 'superior', 'premium', 'prestige'];

const BENEFIT_ROWS = [
  { key: 'accidental_death', patterns: [/accidental death/i], label: 'Accidental death', section: 'Section 1' },
  {
    key: 'double_indemnity',
    patterns: [/double indemnity.*accidental death/i, /accidental death on public transport/i],
    label: 'Double indemnity (public transport)',
    section: 'Section 2',
  },
  { key: 'permanent_disability', patterns: [/permanent disability/i], label: 'Permanent disability', section: 'Section 3' },
  {
    key: 'medical_expenses',
    patterns: [/medical expenses for injury/i, /medical expenses.*accident/i],
    label: 'Medical expenses (accident injury)',
    section: 'Section 4',
  },
  {
    key: 'family_support',
    patterns: [/family support fund/i],
    label: 'Family support fund',
    section: 'Section 12',
  },
];

function capitalizeTier(tier) {
  if (!tier) return '';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function parseDollarAmounts(text) {
  const amounts = [];
  const seen = new Set();

  function push(n) {
    if (!Number.isFinite(n) || n < 100 || seen.has(n)) return;
    seen.add(n);
    amounts.push(n);
  }

  for (const m of (text || '').matchAll(/(?:S\s*\$|\$)\s*([\d,]+(?:\.\d{2})?)/gi)) {
    push(parseInt(m[1].replace(/,/g, ''), 10));
  }
  if (amounts.length >= 5) return amounts;

  for (const m of (text || '').matchAll(/\b(\d{1,3}(?:,\d{3})+)\b/g)) {
    push(parseInt(m[1].replace(/,/g, ''), 10));
  }
  if (amounts.length >= 5) return amounts;

  for (const m of (text || '').matchAll(/(?:^|\s)(\d{5,7})(?:\s|$)/g)) {
    push(parseInt(m[1], 10));
  }
  return amounts;
}

/**
 * After a benefit label, grab the next window of text and pull five tier amounts.
 */
function parseAmountsNearLabel(tableText, labelPattern) {
  const match = tableText.match(new RegExp(`${labelPattern.source}[\\s\\S]{0,800}`, 'i'));
  if (!match) return [];
  return parseDollarAmounts(match[0]);
}

function formatSgd(amount) {
  return `S$${amount.toLocaleString('en-SG')}`;
}

/**
 * Reads the enrolled plan from the "Interest insured" / Plan column, e.g.
 * "Superior with Infectious Disease Coverage".
 */
function extractInsuredPlanTier(text) {
  if (!text) return null;

  const interestBlock = text.match(/Interest\s+insured[\s\S]{0,4000}/i);
  const searchIn = interestBlock ? interestBlock[0] : text;

  const withCoverage = searchIn.match(
    /\b(Basic|Classic|Superior|Premium|Prestige)\s+(?:with\s+)?(?:Infectious\s+Disease\s+)?Coverage\b/i
  );
  if (withCoverage) return withCoverage[1].toLowerCase();

  const withInfectious = searchIn.match(
    /\b(Basic|Classic|Superior|Premium|Prestige)\s+with\s+Infectious\s+Disease\b/i
  );
  if (withInfectious) return withInfectious[1].toLowerCase();

  const afterPlanHeader = searchIn.match(/\bPlan\b[\s\S]{0,120}?\b(Basic|Classic|Superior|Premium|Prestige)\b/i);
  if (afterPlanHeader) return afterPlanHeader[1].toLowerCase();

  // Avoid matching column headers in the full benefit table — only count tiers
  // that appear outside a "Table of cover" header block with all five tiers.
  const tableHeader = text.match(/Table\s+of\s+cover[\s\S]{0,400}/i);
  if (tableHeader && /Basic[\s\S]{0,80}Classic[\s\S]{0,80}Superior[\s\S]{0,80}Premium[\s\S]{0,80}Prestige/i.test(tableHeader[0])) {
    for (const tier of ['superior', 'premium', 'classic', 'basic', 'prestige']) {
      const re = new RegExp(`\\b${tier}\\b`, 'i');
      if (re.test(searchIn) && searchIn !== tableHeader[0]) {
        return tier;
      }
    }
  }

  return null;
}

/**
 * Parses multi-column benefit rows when pdf-parse kept amounts on one line.
 * Returns { accidental_death: { basic: n, classic: n, ... }, ... }.
 */
function parseBenefitTableByTier(text) {
  const section = text.match(/Table\s+of\s+cover[\s\S]{0,15000}/i);
  const tableText = section ? section[0] : text;
  if (!tableText) return {};

  const table = {};

  for (const row of BENEFIT_ROWS) {
    if (table[row.key]) continue;

    for (const pattern of row.patterns) {
      const amounts = parseAmountsNearLabel(tableText, pattern);
      if (amounts.length >= 5) {
        table[row.key] = {};
        TIER_ORDER.forEach((tier, i) => {
          table[row.key][tier] = amounts[i];
        });
        break;
      }
    }

    if (table[row.key]) continue;

    const lines = tableText.split(/\n+/);
    for (const line of lines) {
      if (!row.patterns.some((p) => p.test(line))) continue;
      const amounts = parseDollarAmounts(line);
      if (amounts.length >= 5) {
        table[row.key] = {};
        TIER_ORDER.forEach((tier, i) => {
          table[row.key][tier] = amounts[i];
        });
        break;
      }
    }
  }

  return table;
}

function mergeBenefitTables(parsed, stored) {
  if (!stored || typeof stored !== 'object') return parsed || {};
  const out = { ...(parsed || {}) };
  for (const [key, tiers] of Object.entries(stored)) {
    if (tiers && typeof tiers === 'object') {
      out[key] = { ...(out[key] || {}), ...tiers };
    }
  }
  return out;
}

/** All tier amounts for one benefit row — used when plan tier is unknown. */
function formatBenefitAllTiers(text, benefitKey, storedTable = null) {
  const table = mergeBenefitTables(parseBenefitTableByTier(text), storedTable);
  const row = table[benefitKey];
  if (!row) return null;
  return TIER_ORDER.filter((tier) => row[tier])
    .map((tier) => `${capitalizeTier(tier)}: ${formatSgd(row[tier])}`)
    .join('; ');
}

function getDeathBenefitAnswer(text, tier, storedTable = null) {
  const resolvedTier = tier || extractInsuredPlanTier(text);
  const table = mergeBenefitTables(parseBenefitTableByTier(text), storedTable);
  const death = table.accidental_death;

  if (resolvedTier && death?.[resolvedTier]) {
    const tierLabel = capitalizeTier(resolvedTier);
    const amount = formatSgd(death[resolvedTier]);
    const family = table.family_support?.[resolvedTier];
    const parts = [
      `Accidental death (Section 1, ${tierLabel} plan): beneficiaries would receive up to ${amount} for accidental death, per the Table of cover.`,
    ];
    if (family) {
      parts.push(`Family support fund (Section 12, ${tierLabel} plan): up to ${formatSgd(family)}.`);
    }
    return parts.join(' ');
  }

  if (death && Object.keys(death).length > 0) {
    const allTiers = formatBenefitAllTiers(text, 'accidental_death', storedTable);
    return `Accidental death (Section 1) per Table of cover — amount depends on plan tier: ${allTiers}.`;
  }

  return null;
}

function buildTierCoverageHighlights(text, tier) {
  if (!tier || !TIER_ORDER.includes(tier)) return [];
  const table = parseBenefitTableByTier(text);
  const highlights = [];
  const tierLabel = capitalizeTier(tier);

  for (const row of BENEFIT_ROWS) {
    const amount = table[row.key]?.[tier];
    if (amount) {
      highlights.push(`${row.label} (${row.section}, ${tierLabel} plan): up to ${formatSgd(amount)}`);
    }
  }

  if (highlights.length === 0 && tier) {
    highlights.push(`Enrolled plan tier (from document): ${tierLabel}`);
  }

  return highlights;
}

function extractAmountsFromHighlight(text) {
  const nums = [];
  for (const m of (text || '').matchAll(/\$\s*([\d,]+)/g)) {
    nums.push(parseInt(m[1].replace(/,/g, ''), 10));
  }
  return nums.filter(Number.isFinite);
}

/**
 * Drop AI highlights that quote a higher-tier column amount when we know
 * the customer's enrolled tier.
 */
function filterHighlightsForTier(text, tier, highlights) {
  if (!tier || !Array.isArray(highlights) || highlights.length === 0) return highlights || [];

  const table = parseBenefitTableByTier(text);
  if (Object.keys(table).length === 0) return highlights;

  return highlights.filter((h) => {
    const amounts = extractAmountsFromHighlight(h);
    if (amounts.length === 0) return true;

    for (const row of BENEFIT_ROWS) {
      if (!row.patterns.some((p) => p.test(h))) continue;
      const tierAmount = table[row.key]?.[tier];
      if (!tierAmount) return true;

      for (const amt of amounts) {
        for (const otherTier of TIER_ORDER) {
          if (otherTier === tier) continue;
          const otherAmount = table[row.key]?.[otherTier];
          if (otherAmount && amt === otherAmount && amt !== tierAmount) {
            return false;
          }
        }
        if (amt !== tierAmount && /death|disability|medical|accident/i.test(h)) {
          const prestigeAmt = table[row.key]?.prestige;
          if (prestigeAmt && amt === prestigeAmt && tier !== 'prestige') return false;
        }
      }
    }
    return true;
  });
}

/**
 * Merge deterministic tier-specific highlights with AI output; deterministic wins.
 */
function reconcileCoverageHighlights({ text, tier, aiHighlights = [] }) {
  const deterministic = buildTierCoverageHighlights(text, tier);
  const filteredAi = filterHighlightsForTier(text, tier, aiHighlights);

  if (deterministic.length > 0) {
    const detTexts = new Set(deterministic.map((h) => h.toLowerCase()));
    const extraAi = filteredAi.filter((h) => {
      const lower = h.toLowerCase();
      if (extractAmountsFromHighlight(h).length > 0) {
        return !deterministic.some((d) => extractAmountsFromHighlight(d).some((a) => extractAmountsFromHighlight(h).includes(a)));
      }
      return !detTexts.has(lower);
    });
    return [...deterministic, ...extraAi].slice(0, 6);
  }

  return filterHighlightsForTier(text, tier, aiHighlights).slice(0, 6);
}

module.exports = {
  TIER_ORDER,
  extractInsuredPlanTier,
  parseBenefitTableByTier,
  buildTierCoverageHighlights,
  filterHighlightsForTier,
  reconcileCoverageHighlights,
  getDeathBenefitAnswer,
  formatBenefitAllTiers,
};
