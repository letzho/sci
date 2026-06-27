const PERSONAS = [
  {
    id: 'skeptical_parent',
    label: 'Skeptical Parent',
    emoji: '👨‍👩‍👧',
    description: 'Protective, cautious about sales pitches, cares about family security.',
    opener: "Look, I've been burned by insurance agents before. Why should I listen to you today?",
    customerName: 'Alex Tan',
  },
  {
    id: 'price_millennial',
    label: 'Price-Conscious Millennial',
    emoji: '🧑‍💻',
    description: 'Budget-focused, compares everything online, sceptical of long commitments.',
    opener: "Honestly, I'm already stretched with rent and student loans. This sounds expensive.",
    customerName: 'Mary Lim',
  },
];

function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

module.exports = { PERSONAS, getPersona };
