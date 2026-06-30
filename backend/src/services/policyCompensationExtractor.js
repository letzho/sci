/**
 * Extracts the "Scale of compensation" percentage table common in personal-
 * accident policies (e.g. losing one limb = 50% of sum insured).
 */

const COMPENSATION_SECTION = /scale\s+of\s+compensation[\s\S]{0,8000}/i;

const QUERY_SYNONYMS = {
  limb: ['limb', 'limbs', 'arm', 'leg', 'amputat'],
  eye: ['eye', 'eyes', 'sight', 'vision', 'blind'],
  death: ['death', 'die', 'died', 'fatal', 'deceased'],
  finger: ['finger', 'fingers', 'thumb', 'hand'],
  hearing: ['hearing', 'deaf', 'ear', 'ears'],
  speech: ['speech', 'speak', 'voice', 'talk'],
  disability: ['disability', 'disabled', 'paralys', 'paralyz', 'paralysis'],
  percent: ['percent', 'percentage', '%', 'how much', 'how many'],
};

function normalizeLabel(raw) {
  return (raw || '').replace(/\s+/g, ' ').replace(/[–—-]\s*$/, '').trim();
}

/**
 * @param {string} text - full extracted PDF text
 * @returns {Array<{label: string, percentage: number, text: string}>}
 */
function extractCompensationScale(text) {
  if (!text) return [];
  const section = text.match(COMPENSATION_SECTION);
  if (!section) return [];

  const entries = [];
  const seen = new Set();
  const rowRe = /(?:^|\n)\s*([a-z])[\s.)-]+(.+?)\s+(\d{1,3})\s*%/gi;
  let match;
  while ((match = rowRe.exec(section[0])) !== null) {
    const label = normalizeLabel(match[2]);
    const percentage = parseInt(match[3], 10);
    if (!label || label.length < 4 || !Number.isFinite(percentage)) continue;
    const key = `${label.toLowerCase()}:${percentage}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      label,
      percentage,
      text: `${label}: ${percentage}% of sum insured`,
    });
  }
  return entries;
}

function expandQueryTokens(query) {
  const q = (query || '').toLowerCase();
  const tokens = new Set(q.match(/[a-z0-9]{3,}/g) || []);
  for (const syns of Object.values(QUERY_SYNONYMS)) {
    if (syns.some((s) => q.includes(s))) syns.forEach((s) => tokens.add(s));
  }
  if (/\b(one|single|1)\b/.test(q) && [...tokens].some((t) => t.includes('limb'))) {
    tokens.add('one');
    tokens.add('losing one');
  }
  if (/\b(two|both|2)\b/.test(q) && [...tokens].some((t) => t.includes('limb'))) {
    tokens.add('two');
    tokens.add('losing two');
  }
  return tokens;
}

/**
 * Returns compensation rows from the scale that match the customer's question.
 */
function matchCompensationToQuery(scale, query) {
  if (!scale?.length || !query?.trim()) return [];
  const tokens = expandQueryTokens(query);

  const scored = scale
    .map((entry) => {
      const lower = entry.label.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (t.length >= 3 && lower.includes(t)) score += 1;
      }
      if (/\blimb/.test(query.toLowerCase()) && /losing\s+(one|two)\s+limb/.test(lower)) {
        score += 2;
      }
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.entry.text);
}

function compensationHighlightsFromScale(scale, max = 8) {
  if (!scale?.length) return [];
  return scale.slice(0, max).map((e) => e.text);
}

module.exports = {
  extractCompensationScale,
  matchCompensationToQuery,
  compensationHighlightsFromScale,
};
