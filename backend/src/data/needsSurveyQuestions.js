/**
 * First-meetup needs & preferences survey — embedded in mini-games.
 * No right/wrong answers; helps reps understand client priorities.
 *
 * Learning-based framing (per SCI sponsor feedback): every question comes with
 * a bite-sized "Good to know" insurance fact revealed after the customer
 * answers. Giving the interaction a clear learning purpose lowers the
 * customer's hesitation to share — they get something useful back each time,
 * so it feels like learning together, not being interrogated.
 */

const GAME_OPTIONS = [
  { id: 'minesweeper', label: 'Minesweeper', emoji: '💣' },
  { id: 'snake', label: 'Snake', emoji: '🐍' },
  { id: 'candy_crush', label: 'Candy Crush', emoji: '🍬' },
  { id: 'pop_blast', label: 'Pop Blast', emoji: '🫧' },
  { id: 'tetris', label: 'Tetris', emoji: '🧱' },
];

const surveys = {
  default: {
    title: 'Learn & share — quick check-in',
    intro:
      'Play a mini-game! A few short questions pop up as you play — and each one comes with a quick tip to help you understand your options. No right or wrong answers.',
    questions: [
      {
        id: 'priority',
        preferenceKey: 'top_priority',
        text: 'What matters most to you right now?',
        learn:
          "Good to know: insurance falls into two big jobs — protection (paying out if something happens) and savings/growth. Most people start with protection, then add growth later.",
        options: [
          { id: 'a', text: 'Protecting my family if something happens to me' },
          { id: 'b', text: 'Hospital & medical bills coverage' },
          { id: 'c', text: 'Critical illness / income during recovery' },
          { id: 'd', text: 'Retirement savings & long-term income' },
          { id: 'e', text: 'Growing wealth with some protection' },
        ],
      },
      {
        id: 'dependents',
        preferenceKey: 'dependents',
        text: 'Who are you mainly planning to protect or provide for?',
        learn:
          'Good to know: the more people who rely on your income, the more life cover is usually considered — a common rule of thumb is around 9–10× your annual income, but your rep tailors this to you.',
        options: [
          { id: 'a', text: 'Myself only' },
          { id: 'b', text: 'Spouse / partner' },
          { id: 'c', text: 'Children or parents' },
          { id: 'd', text: 'Whole family' },
        ],
      },
      {
        id: 'budget_style',
        preferenceKey: 'budget_style',
        text: 'How do you prefer to pay for insurance?',
        learn:
          'Good to know: term plans cost less and cover a set period (like renting); whole-life costs more but lasts for life and builds cash value (like buying). Neither is "better" — it depends on your goals.',
        options: [
          { id: 'a', text: 'Low monthly cost — essentials first' },
          { id: 'b', text: 'Balanced monthly budget with good cover' },
          { id: 'c', text: 'Higher cover even if premium is higher' },
          { id: 'd', text: 'Not sure yet — need guidance' },
        ],
      },
      {
        id: 'medisave_awareness',
        preferenceKey: 'medisave_awareness',
        text: 'Did you know part of some health insurance premiums can be paid from MediSave?',
        learn:
          'Good to know: Integrated Shield Plans can often be partly paid from your MediSave, not just cash — so upgrading your hospital cover may cost less out-of-pocket than people expect.',
        options: [
          { id: 'a', text: 'Yes, I use MediSave for this' },
          { id: 'b', text: "I've heard of it but not sure how" },
          { id: 'c', text: 'No — tell me more' },
        ],
      },
    ],
  },
};

function getNeedsSurvey(productType) {
  return { ...surveys.default, productType: productType || null, games: GAME_OPTIONS };
}

module.exports = { surveys, GAME_OPTIONS, getNeedsSurvey };
