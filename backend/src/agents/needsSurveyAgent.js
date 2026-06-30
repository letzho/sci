const { getNeedsSurvey } = require('../data/needsSurveyQuestions');

const PRODUCT_HINTS = {
  top_priority: {
    a: 'life insurance',
    b: 'hospital / Shield plan',
    c: 'critical illness',
    d: 'retirement / CPF LIFE',
    e: 'investment-linked plan',
  },
};

function buildResponseLines(survey, answers) {
  return survey.questions.map((q) => {
    const opt = q.options.find((o) => o.id === answers[q.id]);
    return {
      questionId: q.id,
      question: q.text,
      preferenceKey: q.preferenceKey,
      answerId: answers[q.id] || null,
      answer: opt?.text || '(no answer)',
    };
  });
}

function deriveInsights(responses) {
  const insights = [];
  const priority = responses.find((r) => r.preferenceKey === 'top_priority');
  if (priority?.answerId && PRODUCT_HINTS.top_priority[priority.answerId]) {
    insights.push(`Likely product focus: ${PRODUCT_HINTS.top_priority[priority.answerId]}`);
  }
  const dependents = responses.find((r) => r.preferenceKey === 'dependents');
  if (dependents) insights.push(`Planning for: ${dependents.answer}`);
  const budget = responses.find((r) => r.preferenceKey === 'budget_style');
  if (budget) insights.push(`Premium style: ${budget.answer}`);
  return insights;
}

function buildRepBrief({ customerName, responses, gameChoice, insights }) {
  const name = customerName || 'Your client';
  const top = responses[0]?.answer || 'their priorities';
  return `${name} completed the game survey (${gameChoice || 'mini-game'}). Top priority: ${top}. ${insights.slice(0, 2).join('. ')}.`;
}

async function summarizeNeedsSurvey({ productType, answers, gameChoice, customerName }) {
  const survey = getNeedsSurvey(productType);
  const responses = buildResponseLines(survey, answers || {});
  const insights = deriveInsights(responses);
  const summary = responses.map((r) => `${r.question} → ${r.answer}`).join(' | ');

  return {
    surveyTitle: survey.title,
    customerName: customerName || 'Client',
    gameChoice: gameChoice || 'unknown',
    responses,
    insights,
    summary,
    repBrief: buildRepBrief({ customerName, responses, gameChoice, insights }),
    completedAt: new Date().toISOString(),
  };
}

module.exports = { summarizeNeedsSurvey };
