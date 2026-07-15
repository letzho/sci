/**
 * Product Knowledge (compliance-safe, deterministic)
 * --------------------------------------------------
 * A fixed, approved reference describing what each of the five in-scope
 * product CATEGORIES does, who typically considers it, its trade-offs, and
 * plain-English talking points a representative can use.
 *
 * Design boundary (matches the hackathon brief's "no robo-adviser" rule):
 * this data NEVER tells a customer what to buy. It maps a stated NEED to the
 * product category that addresses it and gives the REP language to explain it.
 * The representative remains the human decision-maker. Everything here is
 * static and reviewed — no generative model produces the product guidance, so
 * it cannot hallucinate a recommendation.
 */

const PRODUCTS = {
  life_insurance: {
    productType: 'life_insurance',
    label: 'Life insurance',
    emoji: '🛡️',
    whatItDoes: 'Pays a lump sum to your family if you pass away or become totally and permanently disabled.',
    protectsAgainst: 'Loss of your income for the people who depend on you.',
    whoOftenConsiders: 'People with dependents, a mortgage, or anyone who is the main income earner.',
    payout: 'Lump sum on death or total permanent disability (TPD).',
    returns: 'Term: none (pure protection). Whole life/endowment: builds guaranteed + non-guaranteed cash value.',
    typicalTerm: 'Term: 10–30 years. Whole life: lifelong.',
    costProfile: 'Term is the lowest cost; whole life/endowment cost more but build value.',
    guaranteedNote: 'Death/TPD benefit is guaranteed; investment/bonus portions of whole-life plans may not be.',
    talkingPoints: [
      'Term life is the most affordable way to get a large payout to protect your family for a set number of years.',
      'Whole life covers you for your entire life and builds a cash value over time, so the premium is higher.',
      'The core payout on death or total permanent disability is guaranteed by the policy.',
    ],
    questionsToAsk: [
      'Who would you want to be financially supported if something happened to you?',
      'Do you have any loans, like a mortgage, that you would want cleared?',
      'How many years of your income would you want your family to be able to replace?',
    ],
  },
  integrated_shield_plan: {
    productType: 'integrated_shield_plan',
    label: 'Integrated Shield Plan',
    emoji: '🏥',
    whatItDoes: 'Adds private hospital cover on top of MediShield Life so more of your hospital bill is covered.',
    protectsAgainst: 'Large hospitalisation and surgery bills, especially in private or higher-class wards.',
    whoOftenConsiders: 'Anyone who wants a choice of hospital/ward beyond the basic MediShield Life default.',
    payout: 'Reimburses eligible inpatient/hospitalisation costs (subject to the plan and any rider).',
    returns: 'Not a savings product — it is protection only.',
    typicalTerm: 'Renewable yearly, for life.',
    costProfile: 'Part of the premium can be paid from MediSave; a rider for cash portions costs extra.',
    guaranteedNote: 'It reimburses eligible bills; it is not a savings or investment plan.',
    talkingPoints: [
      'MediShield Life is the national baseline; an Integrated Shield Plan tops it up so you can choose a higher ward or private hospital.',
      'A big part of the premium can usually be paid from your MediSave, not just cash.',
      'A rider can cover the deductible and co-insurance so your out-of-pocket cash is smaller.',
    ],
    questionsToAsk: [
      'If you were hospitalised, which ward class or hospital type would you prefer?',
      'Would you like to know how much of the premium can come from MediSave?',
      'How important is keeping the cash portion of a bill low for you?',
    ],
  },
  critical_illness: {
    productType: 'critical_illness',
    label: 'Critical illness',
    emoji: '❤️‍🩹',
    whatItDoes: 'Pays a lump sum if you are diagnosed with a covered major illness such as cancer, heart attack or stroke.',
    protectsAgainst: 'Loss of income and extra costs during treatment and recovery — separate from hospital bills.',
    whoOftenConsiders: 'People who want money to keep living and paying bills while they recover, not just medical cover.',
    payout: 'Lump sum on diagnosis of a covered condition (you decide how to use it).',
    returns: 'Standalone CI: protection only. Some plans attach to life policies with cash value.',
    typicalTerm: 'Term-based or lifelong depending on the plan.',
    costProfile: 'Moderate; early-stage/multi-claim options cost more.',
    guaranteedNote: 'Pays on diagnosis of a listed condition — the definitions in the policy matter.',
    talkingPoints: [
      'A Shield plan pays the hospital; critical illness pays YOU a lump sum to spend on anything — rent, daily costs, or income you lose while recovering.',
      'Payout is triggered by diagnosis of a covered condition, not by a hospital bill.',
      'Plans differ in how many conditions they cover and whether they pay at early or only late stages.',
    ],
    questionsToAsk: [
      'If you had to stop working for six months to recover, how would your bills be covered?',
      'Is there a history of major illness in your family you are thinking about?',
      'Would early-stage coverage matter to you, or just major/late-stage?',
    ],
  },
  retirement_cpf: {
    productType: 'retirement_cpf',
    label: 'Retirement plan / CPF LIFE',
    emoji: '🌅',
    whatItDoes: 'Provides an income stream in retirement — via CPF LIFE and/or a private annuity plan.',
    protectsAgainst: 'Running out of money in later years / outliving your savings.',
    whoOftenConsiders: 'People planning ahead for a steady income after they stop working.',
    payout: 'Regular payouts (monthly income), often for life.',
    returns: 'Annuities give a defined income; some plans have guaranteed + non-guaranteed portions.',
    typicalTerm: 'Payouts usually begin at a chosen retirement age and can last for life.',
    costProfile: 'Funded over many years; earlier start usually means lower cost for the same income.',
    guaranteedNote: 'CPF LIFE payouts are backed by the scheme; private annuity non-guaranteed portions can vary.',
    talkingPoints: [
      'CPF LIFE gives you a monthly payout for life; a private annuity can top that up if you want more.',
      'Starting earlier usually means a smaller regular commitment for the same future income.',
      'The idea is a steady income you cannot outlive, rather than one big lump sum.',
    ],
    questionsToAsk: [
      'At what age would you like the option to slow down or stop working?',
      'Do you have a sense of the monthly income you would want in retirement?',
      'Have you looked at what your CPF LIFE payout is projected to be?',
    ],
  },
  ilp: {
    productType: 'ilp',
    label: 'Investment-linked policy (ILP)',
    emoji: '📈',
    whatItDoes: 'Combines insurance cover with investments in funds you choose.',
    protectsAgainst: 'A mix of protection plus the chance to grow money — with market risk.',
    whoOftenConsiders: 'People comfortable with investment risk who want protection and growth in one plan.',
    payout: 'Insurance payout plus the current value of the invested units.',
    returns: 'Market-linked — NOT guaranteed. Value can go up or down.',
    typicalTerm: 'Long-term; charges are usually higher in the early years.',
    costProfile: 'Higher and more complex fees than pure protection; depends on funds chosen.',
    guaranteedNote: 'Returns are NOT guaranteed. The insurance cover and fund value can both change.',
    talkingPoints: [
      'An ILP bundles insurance with investments, so part of your premium buys cover and part is invested in funds.',
      'Because the money is invested, the returns are not guaranteed — the value can rise or fall with the market.',
      'It suits someone who wants protection and growth together and is comfortable with investment risk.',
    ],
    questionsToAsk: [
      'How do you feel about your policy value going up and down with the market?',
      'Are you looking mainly for protection, mainly for growth, or a mix of both?',
      'Do you already invest separately, or would having it inside one plan be simpler for you?',
    ],
  },
};

const PRODUCT_ORDER = ['life_insurance', 'integrated_shield_plan', 'critical_illness', 'retirement_cpf', 'ilp'];

/**
 * Customer NEEDS → the product category that addresses each. Keys line up with
 * the gamified needs-survey's `priority` options (a–e) so a survey answer can
 * be turned straight into rep guidance.
 */
const NEEDS = {
  family_protection: {
    key: 'family_protection',
    label: 'Protect my family / dependents',
    surveyOptionId: 'a',
    productType: 'life_insurance',
  },
  medical_bills: {
    key: 'medical_bills',
    label: 'Cover hospital & medical bills',
    surveyOptionId: 'b',
    productType: 'integrated_shield_plan',
  },
  critical_illness_income: {
    key: 'critical_illness_income',
    label: 'Income if I get a serious illness',
    surveyOptionId: 'c',
    productType: 'critical_illness',
  },
  retirement_income: {
    key: 'retirement_income',
    label: 'Retirement savings & income',
    surveyOptionId: 'd',
    productType: 'retirement_cpf',
  },
  wealth_growth: {
    key: 'wealth_growth',
    label: 'Grow wealth with some protection',
    surveyOptionId: 'e',
    productType: 'ilp',
  },
};

/** Maps a needs-survey `priority` option id back to a need key. */
const SURVEY_OPTION_TO_NEED = Object.fromEntries(
  Object.values(NEEDS).map((n) => [n.surveyOptionId, n.key])
);

/**
 * Keyword triggers for the live "need detected" nudge (feature C). When a
 * customer's transcribed speech / chat mentions one of these, the rep panel
 * can surface the matching product category and its talking points.
 */
const NEED_KEYWORDS = {
  family_protection: [
    'family', 'my kids', 'children', 'my child', 'spouse', 'wife', 'husband', 'dependent', 'dependant',
    'if i die', 'if something happens to me', 'breadwinner', 'mortgage', 'home loan', 'provide for',
  ],
  medical_bills: [
    'hospital', 'hospitalis', 'hospitaliz', 'medical bill', 'surgery', 'ward', 'inpatient', 'admitted',
    'medishield', 'shield plan', 'operation', 'a&e', 'icu',
  ],
  critical_illness_income: [
    'cancer', 'heart attack', 'stroke', 'critical illness', 'major illness', 'serious illness',
    'diagnos', 'chemo', 'if i fall sick', 'income if i', 'cannot work', 'recovery', 'tumour', 'tumor',
  ],
  retirement_income: [
    'retire', 'retirement', 'cpf life', 'pension', 'annuity', 'old age', 'after i stop working',
    'when i am older', 'income later', 'golden years',
  ],
  wealth_growth: [
    'grow my money', 'invest', 'investment', 'returns', 'wealth', 'grow wealth', 'make my money work',
    'higher return', 'fund', 'market',
  ],
};

/** Dimensions for the product-type comparator (feature B). */
const PRODUCT_TYPE_COMPARISON = {
  dimensions: [
    { key: 'protectsAgainst', label: 'Protects against' },
    { key: 'payout', label: 'How it pays out' },
    { key: 'returns', label: 'Returns' },
    { key: 'typicalTerm', label: 'Typical term' },
    { key: 'costProfile', label: 'Cost profile' },
    { key: 'whoOftenConsiders', label: 'Often considered by' },
  ],
  disclaimer:
    'Educational overview of product categories for discussion — not a recommendation to buy any specific product or plan. Your representative will help weigh what suits your situation.',
};

function getProduct(productType) {
  return PRODUCTS[productType] || null;
}

function listProducts() {
  return PRODUCT_ORDER.map((t) => PRODUCTS[t]);
}

/**
 * Detects which needs a piece of customer text mentions (feature C).
 * Returns an ordered, de-duplicated list of need keys, most-matched first.
 */
function detectNeeds(text) {
  if (!text || !text.trim()) return [];
  const lower = text.toLowerCase();
  const scored = [];
  for (const [needKey, keywords] of Object.entries(NEED_KEYWORDS)) {
    const hits = keywords.filter((kw) => lower.includes(kw)).length;
    if (hits > 0) scored.push({ needKey, hits });
  }
  scored.sort((a, b) => b.hits - a.hits);
  return scored.map((s) => s.needKey);
}

module.exports = {
  PRODUCTS,
  PRODUCT_ORDER,
  NEEDS,
  SURVEY_OPTION_TO_NEED,
  NEED_KEYWORDS,
  PRODUCT_TYPE_COMPARISON,
  getProduct,
  listProducts,
  detectNeeds,
};
