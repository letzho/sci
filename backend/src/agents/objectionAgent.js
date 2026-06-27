const { getComparison } = require('../data/insuranceComparisons');
const openaiService = require('../services/openaiService');

const FALLBACK_SCRIPTS = {
  too_expensive: {
    feel: "I completely understand — many families feel the premium is a stretch right now.",
    felt: "Other clients in a similar situation felt the same way before we mapped the numbers together.",
    found: "What they found was that structuring cover around their actual gap — rather than a one-size-fits-all plan — made the monthly amount feel manageable while still protecting what mattered most.",
  },
  need_to_think: {
    feel: "That's a fair response — this is an important decision and you shouldn't feel rushed.",
    felt: "Plenty of thoughtful clients told me they needed time to process before moving forward.",
    found: "What helped them decide was leaving with a clear summary of options and a few specific questions answered — so 'thinking it over' was informed, not anxious.",
  },
  already_have_plan: {
    feel: "It makes sense to start from what you already have — that's responsible planning.",
    felt: "Many clients with existing policies felt they were fully covered until we reviewed the details side by side.",
    found: "What they found was small gaps — like income replacement duration or critical illness limits — that their old plan didn't fully address.",
  },
};

async function generatePivotScript({ objectionKey, productType, customerName, competitiveSnippets }) {
  const objection = objectionKey || 'too_expensive';
  const fallback = FALLBACK_SCRIPTS[objection] || FALLBACK_SCRIPTS.too_expensive;
  const comparison = getComparison(productType || 'life_insurance');
  const compContext = comparison
    ? comparison.insurers.map((i) => `${i.name}: ${i.highlight} (premium indicator: ${i.monthlyPremium || i.managementFee || '—'})`).join('; ')
    : '';
  const webContext = (competitiveSnippets || []).map((s) => s.snippet || s).join(' ');

  if (openaiService.isEnabled()) {
    const script = await generateWithLlm({ objection, productType, customerName, compContext, webContext });
    if (script) return { ...script, source: 'openai', badgeHint: 'talking_point_pro' };
  }

  const steps = [
    { step: 1, label: 'Feel', text: fallback.feel },
    { step: 2, label: 'Felt', text: fallback.felt },
    { step: 3, label: 'Found', text: `${fallback.found}${compContext ? ` For context: ${comparison.insurers[0]?.name} and peers in our comparison data show different premium tiers — happy to walk through that objectively.` : ''}` },
  ];
  return { steps, source: 'rule_engine', badgeHint: 'talking_point_pro', objectionKey: objection };
}

async function generateWithLlm({ objection, productType, customerName, compContext, webContext }) {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            'You help insurance representatives handle objections using Feel-Felt-Found (3 steps). Never recommend products or guarantee outcomes. Return JSON only: {"steps":[{"step":1,"label":"Feel","text":"..."},{"step":2,"label":"Felt","text":"..."},{"step":3,"label":"Found","text":"..."}]}',
        },
        {
          role: 'user',
          content: `Objection: ${objection}\nCustomer: ${customerName || 'prospect'}\nProduct: ${productType || 'general'}\nCompetitive data: ${compContext}\nWeb snippets: ${webContext}\n\nWrite a concise 3-step Feel-Felt-Found script the rep can say verbatim.`,
        },
      ],
    });
    const raw = completion?.choices?.[0]?.message?.content?.trim();
    const json = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(json);
    if (parsed.steps?.length === 3) return parsed;
  } catch {
    /* fallback below */
  }
  return null;
}

module.exports = { generatePivotScript };
