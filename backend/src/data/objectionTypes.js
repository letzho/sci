/** Common client objections — keys used by the Objection Buster pivot matrix. */
const OBJECTIONS = [
  {
    key: 'too_expensive',
    label: 'Too expensive',
    icon: '💰',
    context: 'Client feels the premium is beyond their budget or not worth the cost.',
  },
  {
    key: 'need_to_think',
    label: 'Need to think about it',
    icon: '🤔',
    context: 'Client wants to delay the decision without committing today.',
  },
  {
    key: 'already_have_plan',
    label: 'Already have a plan',
    icon: '📋',
    context: 'Client believes existing coverage makes this conversation unnecessary.',
  },
];

module.exports = { OBJECTIONS };
