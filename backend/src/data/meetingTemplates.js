/**
 * First-meeting and coffee-chat templates for reps initiating prospect conversations.
 */

const templates = [
  {
    id: 'coffee_chat',
    label: 'Coffee chat invite',
    icon: '☕',
    subject: 'Catch up over coffee?',
    message:
      "Hi! I'd love to buy you a coffee and learn more about your goals — no product pitch, just a relaxed chat about what matters to you financially.",
    icebreakers: [
      'What does a good financial future look like for you in 5 years?',
      'Is there anything about insurance or savings that has been on your mind lately?',
    ],
    agenda: ['5 min — introductions', '15 min — your goals & concerns', '10 min — optional next steps (only if you want)'],
    tone: 'warm',
  },
  {
    id: 'discovery_call',
    label: 'Discovery video call',
    icon: '📹',
    subject: 'Quick 20-minute discovery call',
    message:
      "Thanks for connecting! I'd like to schedule a short video call to understand your protection and savings needs — completely at your pace.",
    icebreakers: [
      'What prompted you to explore this conversation now?',
      'Who depends on your income today?',
    ],
    agenda: ['Your current coverage snapshot', 'Gaps you are curious about', 'Questions you have always wanted to ask'],
    tone: 'professional',
  },
  {
    id: 'financial_wellness',
    label: 'Financial wellness check-in',
    icon: '🌱',
    subject: 'Free financial wellness check-in',
    message:
      "I'm offering a complimentary 15-minute wellness check-in — we'll look at protection, emergency funds, and retirement readiness together.",
    icebreakers: [
      'If an unexpected expense hit tomorrow, how prepared would you feel?',
      'When you think about retirement, what worries you most?',
    ],
    agenda: ['Protection adequacy', 'Savings & investment habits', 'One actionable takeaway'],
    tone: 'supportive',
  },
  {
    id: 'first_meeting_virtual',
    label: 'First virtual meet-up',
    icon: '🤝',
    subject: 'Welcome — your first session with me',
    message:
      "Welcome! This first session is about getting to know each other. I'll share how I work, and we'll do a short quiz so I can tailor our conversation to what you already know.",
    icebreakers: [
      'What would make this session valuable for you today?',
      'Have you worked with a financial representative before?',
    ],
    agenda: ['Introductions', '2-question warm-up quiz', 'Open Q&A — your questions first'],
    tone: 'welcoming',
    suggestQuiz: true,
  },
];

function getTemplate(id) {
  return templates.find((t) => t.id === id) || templates[0];
}

module.exports = { templates, getTemplate };
