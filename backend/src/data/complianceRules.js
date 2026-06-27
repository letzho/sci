/**
 * Seed compliance rules: phrases that should be flagged when spoken/typed by
 * a representative, because they cross the line from "explaining a product"
 * into "advising, recommending, guaranteeing or pressuring" — which this
 * tool must never do (see hackathon brief boundary: no robo-advice).
 *
 * These are intentionally kept general (product_type: null) because the
 * underlying compliance concern (overpromising, undue pressure, personal
 * guarantees) applies across every product line.
 */

const complianceRules = [
  {
    flagged_phrase: 'guaranteed returns',
    product_type: null,
    severity: 'high',
    reason: "Implies guaranteed investment performance, which is misleading for non-guaranteed products such as ILPs or participating policies.",
    suggested_replacement: "Say 'potential returns, which are not guaranteed' and refer to the benefit illustration.",
  },
  {
    flagged_phrase: 'i recommend',
    product_type: null,
    severity: 'high',
    reason: "Representatives must not give personal recommendations or advice — this tool supports explanation, not advice.",
    suggested_replacement: "Say 'here's some information about this option' and direct the customer to a licensed financial adviser for personalised advice.",
  },
  {
    flagged_phrase: 'best policy for you',
    product_type: null,
    severity: 'high',
    reason: "Implies a personalised recommendation, which representatives using this tool must not provide.",
    suggested_replacement: "Say 'here are the features of this policy' and let the customer compare it against their own needs.",
  },
  {
    flagged_phrase: 'you should buy',
    product_type: null,
    severity: 'high',
    reason: "Directive sales language — representatives should inform, not instruct.",
    suggested_replacement: "Say 'you may wish to discuss this further with your adviser before deciding'.",
  },
  {
    flagged_phrase: 'definitely covers everything',
    product_type: null,
    severity: 'high',
    reason: "Overstates coverage — every policy has exclusions and limits that must be disclosed.",
    suggested_replacement: "Say 'this covers the conditions listed in the policy, subject to exclusions'.",
  },
  {
    flagged_phrase: 'no risk',
    product_type: null,
    severity: 'high',
    reason: "All investment-linked or market-linked products carry some risk; stating 'no risk' is misleading.",
    suggested_replacement: "Say 'this carries a level of risk depending on the fund chosen' and refer to the fund fact sheet.",
  },
  {
    flagged_phrase: 'act now',
    product_type: null,
    severity: 'medium',
    reason: "Creates undue urgency or pressure to purchase, inconsistent with fair dealing principles.",
    suggested_replacement: "Avoid urgency language — let the customer take the time they need to decide.",
  },
  {
    flagged_phrase: 'limited time only',
    product_type: null,
    severity: 'medium',
    reason: "Creates undue urgency or pressure to purchase, inconsistent with fair dealing principles.",
    suggested_replacement: "Avoid urgency language — let the customer take the time they need to decide.",
  },
  {
    flagged_phrase: 'trust me',
    product_type: null,
    severity: 'medium',
    reason: "A personal assurance is not a substitute for documented policy terms.",
    suggested_replacement: "Refer the customer to the written policy contract or product summary instead.",
  },
  {
    flagged_phrase: 'will definitely grow',
    product_type: null,
    severity: 'high',
    reason: "Predicts investment performance, which is not permitted for non-guaranteed products.",
    suggested_replacement: "Say 'past performance is not indicative of future returns'.",
  },
  {
    flagged_phrase: 'skip the medical check',
    product_type: null,
    severity: 'high',
    reason: "Suggesting customers bypass underwriting disclosure requirements is a compliance and fraud risk.",
    suggested_replacement: "Always direct customers to complete full and honest health disclosure.",
  },
  {
    flagged_phrase: 'fully covered, no exclusions',
    product_type: null,
    severity: 'high',
    reason: "Every policy carries some exclusions or limitations that must be disclosed.",
    suggested_replacement: "Say 'here are the key exclusions to be aware of' and refer to the policy document.",
  },
  {
    flagged_phrase: 'i guarantee',
    product_type: null,
    severity: 'high',
    reason: "A personal guarantee from a representative is not contractually binding and can mislead the customer.",
    suggested_replacement: "Refer only to what is contractually guaranteed in the policy document.",
  },
  {
    flagged_phrase: "don't worry about the fine print",
    product_type: null,
    severity: 'high',
    reason: "Discourages full understanding of policy terms, against fair dealing principles.",
    suggested_replacement: "Encourage the customer to read, or ask about, anything unclear in the terms.",
  },
];

module.exports = { complianceRules };
