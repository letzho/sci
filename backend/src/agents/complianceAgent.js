const ruleEngine = require('../services/ruleEngine');

/**
 * Compliance Agent
 * ----------------
 * Scans the same text for risky/non-compliant phrasing (e.g. "guaranteed
 * returns", "I recommend", "best policy for you") and returns the matched
 * rule plus the pre-approved replacement wording. Runs independently of the
 * Knowledge Agent so a flag is raised even if no talking point matched.
 */

const AGENT_NAME = 'Compliance Agent';

/**
 * @param {{text: string, productType: ?string}} input
 * @returns {Array} compliance flags: { id, phrase, severity, reason, suggestedReplacement }
 */
async function checkCompliance({ text, productType }) {
  const flags = await ruleEngine.findComplianceFlags(text, productType);
  if (flags.length > 0) {
    console.log(`[${AGENT_NAME}] flagged ${flags.length} phrase(s): ${flags.map((f) => `"${f.phrase}"`).join(', ')}`);
  } else {
    console.log(`[${AGENT_NAME}] no compliance issues found`);
  }
  return flags;
}

module.exports = { checkCompliance, AGENT_NAME };
