const { getQuiz } = require('../data/quizQuestions');
const openaiService = require('../services/openaiService');

/**
 * Grades a first-meetup quiz submission. Rule-based marking is always
 * available; OpenAI adds a short personalised feedback paragraph when enabled.
 */
async function gradeQuiz({ productType, answers, customerName }) {
  const quiz = getQuiz(productType);
  const results = quiz.questions.map((q) => {
    const selected = answers[q.id];
    const correct = selected === q.correctOptionId;
    const selectedOption = q.options.find((o) => o.id === selected);
    const correctOption = q.options.find((o) => o.id === q.correctOptionId);
    return {
      questionId: q.id,
      questionText: q.text,
      selectedOptionId: selected,
      selectedText: selectedOption?.text || '(no answer)',
      correctOptionId: q.correctOptionId,
      correctText: correctOption?.text,
      isCorrect: correct,
      explanation: q.explanation,
    };
  });

  const score = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const pct = Math.round((score / total) * 100);

  let aiFeedback = null;
  if (openaiService.isEnabled()) {
    aiFeedback = await generateAiFeedback({ customerName, quiz, results, score, total });
  }
  if (!aiFeedback) {
    aiFeedback = buildRuleFeedback({ customerName, score, total, results });
  }

  return {
    quizTitle: quiz.title,
    score,
    total,
    pct,
    results,
    aiFeedback,
    gradedAt: new Date().toISOString(),
  };
}

function buildRuleFeedback({ customerName, score, total, results }) {
  const name = customerName ? customerName.split(' ')[0] : 'there';
  if (score === total) {
    return `Great work, ${name}! You got both questions right — you already have a solid foundation. Let's build on that together.`;
  }
  if (score === 1) {
    const missed = results.find((r) => !r.isCorrect);
    return `Nice effort, ${name}! You got 1 of ${total}. The key point on "${missed?.questionText.slice(0, 40)}…" is worth exploring — I'll walk you through it.`;
  }
  return `Thanks for trying, ${name}! These topics can be tricky at first — that's exactly what our conversation is for. No pressure, we'll go at your pace.`;
}

async function generateAiFeedback({ customerName, quiz, results, score, total }) {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const summary = results
      .map((r) => `- Q: ${r.questionText}\n  Answered: ${r.selectedText}\n  Correct: ${r.isCorrect ? 'Yes' : 'No'}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'You are a warm insurance representative assistant. Give 2 sentences of encouraging feedback after a 2-question literacy quiz. Never recommend products. Be supportive, not salesy.',
        },
        {
          role: 'user',
          content: `Customer: ${customerName || 'prospect'}\nQuiz: ${quiz.title}\nScore: ${score}/${total}\n${summary}\n\nWrite brief feedback for the rep to share.`,
        },
      ],
    });
    return completion?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

module.exports = { gradeQuiz };
