/**
 * First-meetup insurance literacy quiz — 2 questions per product line.
 * Used during virtual calls so reps can warm up prospects and AI marks answers.
 */

const quizzes = {
  life_insurance: {
    title: 'Life insurance basics',
    intro: 'A quick 2-question check-in to see what you already know — no wrong answers, just a conversation starter.',
    questions: [
      {
        id: 'life_q1',
        text: 'What is the main purpose of term life insurance?',
        options: [
          { id: 'a', text: 'Build cash value for retirement' },
          { id: 'b', text: 'Provide a lump-sum payout to beneficiaries if the insured passes away during the term' },
          { id: 'c', text: 'Guarantee investment returns' },
        ],
        correctOptionId: 'b',
        explanation:
          'Term life is primarily about income replacement and family protection for a fixed period — it does not build cash value like whole life.',
      },
      {
        id: 'life_q2',
        text: 'During the free-look period in Singapore, a policyholder can generally:',
        options: [
          { id: 'a', text: 'Switch insurers without medical checks' },
          { id: 'b', text: 'Review the policy and request a refund within 14 days of receiving the document' },
          { id: 'c', text: 'Increase sum assured for free' },
        ],
        correctOptionId: 'b',
        explanation:
          'The 14-day free-look period lets you review terms and cancel for a refund (less medical costs if any) if you decide not to proceed.',
      },
    ],
  },
  critical_illness: {
    title: 'Critical illness awareness',
    intro: 'Two quick questions to explore how critical illness cover works.',
    questions: [
      {
        id: 'ci_q1',
        text: 'Critical illness insurance typically pays out when:',
        options: [
          { id: 'a', text: 'You visit a GP for a flu' },
          { id: 'b', text: 'You are diagnosed with a covered serious illness as defined in the policy' },
          { id: 'c', text: 'You retire at age 65' },
        ],
        correctOptionId: 'b',
        explanation: 'CI pays a lump sum on diagnosis of specified conditions (e.g. major cancers, heart attack) per policy definitions.',
      },
      {
        id: 'ci_q2',
        text: 'Why do some people buy CI cover on top of hospital insurance?',
        options: [
          { id: 'a', text: 'To pay hospital bills only' },
          { id: 'b', text: 'To help cover income loss, recovery costs, and lifestyle adjustments during treatment' },
          { id: 'c', text: 'Because it is legally required' },
        ],
        correctOptionId: 'b',
        explanation: 'Hospital plans cover medical bills; CI provides a lump sum for broader financial needs during recovery.',
      },
    ],
  },
  ilp: {
    title: 'Investment-linked plans',
    intro: 'A short quiz on how ILPs work — useful for first-time investors.',
    questions: [
      {
        id: 'ilp_q1',
        text: 'In an investment-linked policy (ILP), your premium is typically:',
        options: [
          { id: 'a', text: 'Fully guaranteed regardless of market conditions' },
          { id: 'b', text: 'Split between insurance charges and units in investment funds' },
          { id: 'c', text: 'Deposited in a fixed bank account only' },
        ],
        correctOptionId: 'b',
        explanation: 'ILPs combine insurance protection with fund units — values fluctuate with market performance.',
      },
      {
        id: 'ilp_q2',
        text: 'Which statement about ILP fund values is most accurate?',
        options: [
          { id: 'a', text: 'They can go up or down depending on fund performance' },
          { id: 'b', text: 'They are always guaranteed to grow' },
          { id: 'c', text: 'They never change after purchase' },
        ],
        correctOptionId: 'a',
        explanation: 'ILP values are not guaranteed and depend on underlying fund performance and charges.',
      },
    ],
  },
  integrated_shield_plan: {
    title: 'Integrated Shield Plans',
    intro: 'Quick check on how hospital insurance works in Singapore.',
    questions: [
      {
        id: 'isp_q1',
        text: 'MediShield Life covers:',
        options: [
          { id: 'a', text: 'All private hospital bills with no limits' },
          { id: 'b', text: 'Basic subsidised hospitalisation costs for Singapore citizens and PRs' },
          { id: 'c', text: 'Only dental treatment' },
        ],
        correctOptionId: 'b',
        explanation: 'MediShield Life is the basic national scheme; Integrated Shield Plans add coverage for private/class A/B wards.',
      },
      {
        id: 'isp_q2',
        text: 'An Integrated Shield Plan (IP) mainly helps with:',
        options: [
          { id: 'a', text: 'Higher ward class and larger claim limits beyond MediShield Life' },
          { id: 'b', text: 'Free annual health screening for everyone' },
          { id: 'c', text: 'Guaranteed zero co-payment on all treatments' },
        ],
        correctOptionId: 'a',
        explanation: 'IPs upgrade hospital coverage; co-payments and deductibles may still apply depending on the plan and rider.',
      },
    ],
  },
  retirement_cpf: {
    title: 'Retirement & CPF',
    intro: 'Two questions on building retirement readiness.',
    questions: [
      {
        id: 'ret_q1',
        text: 'CPF LIFE provides:',
        options: [
          { id: 'a', text: 'A one-time lump sum at age 55 with no further payouts' },
          { id: 'b', text: 'Monthly payouts for life from a chosen payout age' },
          { id: 'c', text: 'Free private hospital cover' },
        ],
        correctOptionId: 'b',
        explanation: 'CPF LIFE converts your retirement sum into lifelong monthly payouts from your chosen starting age.',
      },
      {
        id: 'ret_q2',
        text: 'Why might someone supplement CPF with private retirement planning?',
        options: [
          { id: 'a', text: 'Because CPF payouts are always enough for any lifestyle' },
          { id: 'b', text: 'To bridge the gap between desired retirement income and projected CPF payouts' },
          { id: 'c', text: 'It is mandatory for all employees' },
        ],
        correctOptionId: 'b',
        explanation: 'Many people plan additional savings (e.g. SRS, investments) to meet their personal retirement income target.',
      },
    ],
  },
};

function getQuiz(productType) {
  return quizzes[productType] || quizzes.life_insurance;
}

module.exports = { quizzes, getQuiz };
