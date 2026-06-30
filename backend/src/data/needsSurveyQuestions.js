/**
 * First-meetup needs & preferences survey — embedded in mini-games.
 * No right/wrong answers; helps reps understand client priorities.
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
    title: 'Quick needs check-in',
    intro:
      'Pick a mini-game! Short questions will pop up while you play — just tap your answer and the game continues.',
    questions: [
      {
        id: 'priority',
        preferenceKey: 'top_priority',
        text: 'What matters most to you right now?',
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
        options: [
          { id: 'a', text: 'Low monthly cost — essentials first' },
          { id: 'b', text: 'Balanced monthly budget with good cover' },
          { id: 'c', text: 'Higher cover even if premium is higher' },
          { id: 'd', text: 'Not sure yet — need guidance' },
        ],
      },
    ],
  },
};

function getNeedsSurvey(productType) {
  return { ...surveys.default, productType: productType || null, games: GAME_OPTIONS };
}

module.exports = { surveys, GAME_OPTIONS, getNeedsSurvey };
