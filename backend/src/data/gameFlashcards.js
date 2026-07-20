const { PRODUCTS, PRODUCT_ORDER } = require('./productKnowledge');

/**
 * Mini-game flash cards — replaces the old milestone Q&A survey.
 *
 * Rationale (sponsor feedback): asking the customer questions while they play
 * feels like an interrogation and undermines the trust the game is meant to
 * build, and a fixed set of questions gets repetitive fast. A short, engaging
 * insurance fact revealed as a reward for playing keeps the same "pause and
 * show something" mechanic without any of that — it's pure information, never
 * a question, and there is nothing to answer or get wrong. No preference data
 * is collected; this is purely an engagement/education moment.
 */

const GAME_OPTIONS = [
  { id: 'minesweeper', label: 'Minesweeper', emoji: '💣' },
  { id: 'snake', label: 'Snake', emoji: '🐍' },
  { id: 'candy_crush', label: 'Candy Crush', emoji: '🍬' },
  { id: 'pop_blast', label: 'Pop Blast', emoji: '🫧' },
  { id: 'tetris', label: 'Tetris', emoji: '🧱' },
];

// Cards built from the same approved product facts used elsewhere in the app
// (Product Fit Guide, live guidance), so what a customer learns here is
// consistent with what the rep says in conversation.
function cardsFromProducts() {
  return PRODUCT_ORDER.map((type) => {
    const p = PRODUCTS[type];
    return {
      id: `product_${type}`,
      emoji: p.emoji,
      title: p.label,
      fact: p.talkingPoints[0],
    };
  });
}

// General "did you know" facts — not tied to one product, keeps the deck
// varied instead of feeling like a product pitch.
const GENERAL_CARDS = [
  {
    id: 'general_freelook',
    emoji: '🔍',
    title: 'The "free-look" period',
    fact: 'Most policies in Singapore give you a free-look period (often 14–21 days) to review the contract and cancel for a full refund if it is not right for you.',
  },
  {
    id: 'general_mas',
    emoji: '🛡️',
    title: 'MAS-regulated market',
    fact: 'All licensed insurers here are regulated by the Monetary Authority of Singapore, which sets rules on how products are sold and explained to you.',
  },
  {
    id: 'general_medisave',
    emoji: '💳',
    title: 'MediSave can help pay premiums',
    fact: 'For approved plans like Integrated Shield Plans, part of the premium can be paid using your MediSave savings, not just cash.',
  },
  {
    id: 'general_review',
    emoji: '📅',
    title: 'Coverage needs change over time',
    fact: 'Big life events — marriage, a new child, a new home — are common moments to review whether your existing coverage still fits.',
  },
  {
    id: 'general_disclosure',
    emoji: '📝',
    title: 'Full & honest disclosure matters',
    fact: 'Answering health and lifestyle questions accurately when applying helps make sure a claim is not disputed later on.',
  },
];

/** @returns {{ id, emoji, title }[]} the mini-games a customer can choose to play */
function listGames() {
  return GAME_OPTIONS;
}

/**
 * Builds a flash-card deck for a session. If a productType is known, its
 * facts lead the deck (most relevant to this conversation), otherwise the
 * cards are in a fixed, still-varied order.
 */
function getFlashcardDeck(productType) {
  const productCards = cardsFromProducts();
  let cards;
  if (productType) {
    const lead = productCards.filter((c) => c.id === `product_${productType}`);
    const rest = productCards.filter((c) => c.id !== `product_${productType}`);
    cards = [...lead, ...GENERAL_CARDS.slice(0, 2), ...rest, ...GENERAL_CARDS.slice(2)];
  } else {
    cards = [...productCards.slice(0, 2), ...GENERAL_CARDS, ...productCards.slice(2)];
  }

  return {
    title: 'Play & learn',
    intro: 'Pick a mini-game — every so often you\'ll get a quick, interesting insurance fact. Just tap to keep playing.',
    productType: productType || null,
    cards,
    games: listGames(),
  };
}

module.exports = { getFlashcardDeck, GAME_OPTIONS };
