const { PRODUCTS, PRODUCT_ORDER } = require('./productKnowledge');

/**
 * "Did You Know?" insight cards shown during the mini-game.
 *
 * Rationale (sponsor feedback): asking the customer questions while they play
 * felt like an interrogation and a fixed question set got repetitive, which
 * undermined the trust the game is meant to build. Instead each milestone
 * reveals a short, interesting insurance fact — pure information, nothing to
 * answer, nothing to get wrong.
 *
 * Cards are drawn at random each session (so replaying feels fresh) and are
 * weighted toward products the customer does NOT already hold — that is the
 * cross-sell/upsell angle, but kept strictly educational: cards explain what a
 * product DOES, never "you should buy this". The representative remains the
 * only one who can recommend anything.
 */

const GAME_OPTIONS = [
  { id: 'minesweeper', label: 'Minesweeper', emoji: '💣' },
  { id: 'snake', label: 'Snake', emoji: '🐍' },
  { id: 'candy_crush', label: 'Candy Crush', emoji: '🍬' },
  { id: 'pop_blast', label: 'Pop Blast', emoji: '🫧' },
  { id: 'tetris', label: 'Tetris', emoji: '🧱' },
];

/** How many cards a single play session reveals. */
const CARDS_PER_SESSION = 4;

/**
 * Product cards, built from the same approved facts the Product Fit Guide and
 * live guidance use — so what a customer learns here matches what their rep
 * says. Two cards per product keeps the pool varied across replays.
 */
function productCards() {
  const cards = [];
  for (const type of PRODUCT_ORDER) {
    const p = PRODUCTS[type];
    cards.push({
      id: `${type}_what`,
      productType: type,
      emoji: p.emoji,
      title: p.label,
      fact: p.talkingPoints[0],
    });
    if (p.talkingPoints[1]) {
      cards.push({
        id: `${type}_more`,
        productType: type,
        emoji: p.emoji,
        title: p.label,
        fact: p.talkingPoints[1],
      });
    }
  }
  return cards;
}

/**
 * Cards that explain how products COMPLEMENT each other. These are the
 * natural cross-sell educators — they show a gap without ever telling the
 * customer what to buy.
 */
const COMPLEMENT_CARDS = [
  {
    id: 'x_shield_vs_ci',
    productType: 'critical_illness',
    emoji: '🏥',
    title: 'Hospital bills vs. your bills',
    fact: 'A Shield plan pays the hospital. A critical illness plan pays YOU a lump sum — for rent, daily costs, or income lost while recovering. They cover very different problems.',
  },
  {
    id: 'x_term_vs_whole',
    productType: 'life_insurance',
    emoji: '🏠',
    title: 'Renting vs. buying cover',
    fact: 'Term life is like renting — lower cost, covers a set number of years. Whole life is like buying — costs more, lasts for life and builds a cash value. Neither is "better"; they solve different goals.',
  },
  {
    id: 'x_protection_vs_growth',
    productType: 'ilp',
    emoji: '⚖️',
    title: 'Protection and growth are different jobs',
    fact: 'Pure protection plans pay out if something happens. Investment-linked plans also invest part of your premium — so their value can go up or down with the market, and returns are not guaranteed.',
  },
  {
    id: 'x_cpf_gap',
    productType: 'retirement_cpf',
    emoji: '🌅',
    title: 'CPF LIFE is a floor, not a ceiling',
    fact: 'CPF LIFE gives a monthly payout for life, but it is designed as a basic income floor. Many people top it up with a private annuity if they want more than the basics in retirement.',
  },
  {
    id: 'x_early_stage',
    productType: 'critical_illness',
    emoji: '🔬',
    title: 'Not all critical illness cover is the same',
    fact: 'Some plans only pay at late stages of an illness, while others also pay at early stages. The number of conditions covered — and at which stage — varies a lot between insurers.',
  },
  {
    id: 'x_medisave',
    productType: 'integrated_shield_plan',
    emoji: '💳',
    title: 'MediSave can pay part of the premium',
    fact: 'For Integrated Shield Plans, a portion of the premium can usually be paid from MediSave rather than cash — so better hospital cover can cost less out-of-pocket than people expect.',
  },
];

/** General insurance literacy — not tied to any one product. */
const GENERAL_CARDS = [
  {
    id: 'g_freelook',
    emoji: '🔍',
    title: 'The "free-look" period',
    fact: 'Most policies in Singapore give you a free-look period (often 14–21 days) to read the contract properly and cancel for a refund if it is not right for you.',
  },
  {
    id: 'g_mas',
    emoji: '🛡️',
    title: 'A regulated market',
    fact: 'Every licensed insurer here is regulated by the Monetary Authority of Singapore, which sets rules on how products are sold and explained to you.',
  },
  {
    id: 'g_disclosure',
    emoji: '📝',
    title: 'Honest answers protect your claim',
    fact: 'Answering health and lifestyle questions accurately when you apply is what stops a claim being disputed years later. When in doubt, over-share.',
  },
  {
    id: 'g_life_events',
    emoji: '📅',
    title: 'Cover should follow your life',
    fact: 'Marriage, a new child, a home loan or a career change are the usual moments people find their old cover no longer matches their life.',
  },
  {
    id: 'g_illustration',
    emoji: '📊',
    title: 'Projections are illustrations, not promises',
    fact: 'Investment projections you are shown use rates capped by MAS for illustration. They show a range of what could happen — they are not a guarantee of what will.',
  },
  {
    id: 'g_exclusions',
    emoji: '🚫',
    title: 'Exclusions are worth two minutes',
    fact: 'Every policy has exclusions — things it will not pay for. Reading that one short section is the fastest way to avoid a surprise at claim time.',
  },
  {
    id: 'g_earlier_cheaper',
    emoji: '⏳',
    title: 'Age affects price permanently',
    fact: 'Premiums are largely set by your age and health when you start. Starting earlier usually locks in a lower rate for the life of the policy.',
  },
  {
    id: 'g_claim_together',
    emoji: '🤝',
    title: 'You do not claim alone',
    fact: 'Your representative helps you through the claim paperwork too — that support is part of what you get, not just the policy document.',
  },
];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function listGames() {
  return GAME_OPTIONS;
}

/**
 * Builds a randomised set of insight cards for one play session.
 *
 * @param {object}   [opts]
 * @param {?string}  [opts.productType]        product being discussed — its cards are de-prioritised (already covered in conversation)
 * @param {string[]} [opts.heldProductTypes]   what the customer already owns — cards about OTHER products are favoured
 * @param {number}   [opts.count]              how many cards to reveal
 */
function getFlashcardDeck({ productType = null, heldProductTypes = [], count = CARDS_PER_SESSION } = {}) {
  const held = new Set(heldProductTypes || []);
  const pool = [...productCards(), ...COMPLEMENT_CARDS];

  // Cards about products the customer does NOT hold are the interesting ones —
  // they surface a gap the rep can pick up on. Cards about what they already
  // own are still useful, just less of a priority.
  const gapCards = pool.filter((c) => c.productType && !held.has(c.productType));
  const ownedCards = pool.filter((c) => c.productType && held.has(c.productType));

  const picked = [];
  const takeFrom = (list, n) => {
    for (const card of shuffle(list)) {
      if (picked.length >= count || n <= 0) break;
      if (picked.some((p) => p.id === card.id)) continue;
      picked.push(card);
      n -= 1;
    }
  };

  takeFrom(gapCards, 2); // lead with coverage they don't have yet
  takeFrom(GENERAL_CARDS, 1); // one piece of general literacy keeps it from feeling like a pitch
  takeFrom([...gapCards, ...ownedCards, ...GENERAL_CARDS], count - picked.length);

  return {
    title: 'Did You Know?',
    intro: 'Pick a mini-game — a quick insurance insight pops up as you play. Nothing to answer, just tap to carry on.',
    productType,
    cards: shuffle(picked).slice(0, count),
    games: listGames(),
  };
}

module.exports = { getFlashcardDeck, GAME_OPTIONS, CARDS_PER_SESSION };
