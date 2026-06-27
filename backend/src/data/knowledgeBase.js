/**
 * Seed knowledge base: approved messaging for client-facing representatives.
 *
 * Each entry maps a product line + topic to:
 *  - keywords: trigger words/phrases matched against live transcript/chat text
 *  - approved_message: compliance-approved wording the rep can say verbatim
 *  - plain_english: a simplified, layman-friendly explanation of the same point
 *
 * IMPORTANT: content here is explanatory/informational only. It deliberately
 * avoids personal recommendations, guarantees, or "you should buy" language,
 * in line with the no-advice boundary for this tool (it supports reps, it
 * does not act as a robo-adviser).
 */

const PRODUCT_TYPES = {
  LIFE: 'life_insurance',
  ILP: 'ilp',
  CI: 'critical_illness',
  ISP: 'integrated_shield_plan',
  RETIREMENT: 'retirement_cpf',
};

const knowledgeBase = [
  // ---------- Life insurance ----------
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'Term vs whole life',
    keywords: 'term life,whole life,difference,which type,duration,term insurance',
    approved_message:
      "Term life insurance provides death and total permanent disability (TPD) coverage for a fixed period at a lower premium, with no cash value. Whole life insurance provides coverage for life and includes a cash value component that can accumulate over time, typically at a higher premium.",
    plain_english:
      "Term insurance is like renting protection for a set number of years — cheaper, but it ends when the term ends. Whole life covers you for as long as you live and slowly builds some savings value too, but costs more.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'What death and TPD cover means',
    keywords: 'death cover,tpd,total permanent disability,what does it cover,payout',
    approved_message:
      "This policy pays a lump sum to your named beneficiaries upon death, and a lump sum to you if you are diagnosed as totally and permanently disabled, as defined in the policy contract.",
    plain_english:
      "If you pass away, or become permanently unable to work, this payout goes to your family or to you — to help replace lost income.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'Premium structure',
    keywords: 'premium,how much,cost,price,how is premium calculated',
    approved_message:
      "Premiums are determined by factors including age, sum assured, policy term, and health declaration at the point of application, as set out in your policy illustration.",
    plain_english:
      "What you pay depends mainly on your age, how much coverage you choose, and your health — younger and healthier usually means a lower premium.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'Free-look period',
    keywords: 'free look,cancel,change my mind,cooling off,refund',
    approved_message:
      "You have a free-look period of 14 days from the date you receive your policy document to review the terms and request a full refund of premiums paid, less any medical examination costs, if you decide not to proceed.",
    plain_english:
      "After your policy is issued, you get 14 days to read everything through and change your mind for a full refund, if needed.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'Endowment maturity payout',
    keywords: 'endowment,maturity,payout date,guaranteed sum',
    approved_message:
      "Endowment plans pay out a maturity benefit at the end of the policy term, which may include a guaranteed and a non-guaranteed component as illustrated in your benefit illustration.",
    plain_english:
      "An endowment plan pays a lump sum at a set future date — part of that is guaranteed, and part depends on how the insurer's fund performs.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'General factors when choosing a plan',
    keywords:
      'what plan is suitable,which plan should i get,what should i choose,suitable plan,recommend a plan,best plan for me,which one should i pick,what is suitable,suitable for me,which is right for me',
    approved_message:
      "Plan suitability depends on factors such as budget, how long coverage is needed, whether a cash value component is wanted, and the customer's family protection needs. A full financial needs analysis with a representative or licensed adviser is needed to match these factors to an individual's specific situation.",
    plain_english:
      "There's no single answer here — it depends on things like your budget, how long you need the cover for, and whether you want some savings built in too. Let's go through your situation together so we can see what actually fits you.",
  },
  {
    product_type: PRODUCT_TYPES.LIFE,
    topic: 'Comparing two policies',
    keywords: 'compare,comparison,which is better,versus,difference between my policies,help me compare,two plan,two policies,two insurance plan',
    approved_message:
      "When comparing two policies, useful reference points include the premium, sum assured, policy term, cash value (if any), and riders attached. A representative can review specific policy illustrations side by side with the customer.",
    plain_english:
      "Good things to compare are: how much you pay, how much cover you get, how long it lasts, and any extras (riders). I can pull up your two policies right now and we can go through them side by side.",
  },

  // ---------- Investment-linked policies ----------
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'What is an ILP',
    keywords: 'ilp,investment-linked,what is this product,investment linked policy',
    approved_message:
      "An investment-linked policy combines life insurance protection with investment in sub-funds you select. Premiums are used to purchase units in these sub-funds, and a portion covers insurance charges.",
    plain_english:
      "Part of what you pay buys insurance protection, and part is invested in funds you choose — so the value can go up or down depending on how those funds perform.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'Returns are not guaranteed',
    keywords: 'returns,guaranteed,how much will i get,performance,grow my money',
    approved_message:
      "The investment returns of an ILP are not guaranteed. The value of your units will fluctuate with the performance of the underlying sub-funds, and you may receive less than the total premiums paid.",
    plain_english:
      "Unlike a savings account, the money in an ILP can go down as well as up — there's no guarantee on how much you'll get back.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'Insurance charges deducted from units',
    keywords: 'charges,fees,deduction,unit deduction,cost of insurance',
    approved_message:
      "Insurance and policy charges are deducted by cancelling units from your account, which may increase over time as you age, as disclosed in the product summary.",
    plain_english:
      "The cost of your insurance cover is taken from your invested funds regularly, and this usually increases as you get older.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'Switching funds',
    keywords: 'switch fund,change fund,reallocate,fund choice',
    approved_message:
      "Policyholders may switch between available sub-funds subject to the terms, conditions and any charges set out in the policy contract.",
    plain_english:
      "You can usually move your money between different fund choices later on, though there may be a fee or limit on how often you can do this.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'Understanding fund risk levels',
    keywords: 'risk,volatile,market risk,downturn,risk profile',
    approved_message:
      "Sub-fund choices carry varying degrees of investment risk. Please refer to the fund fact sheet for the risk classification of each sub-fund.",
    plain_english:
      "Some funds are more conservative, some more aggressive — the fund fact sheet shows each fund's risk level.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'General factors when choosing fund mix',
    keywords:
      'which fund is suitable,what fund should i pick,suitable fund,recommend a fund,best fund for me,which ilp is suitable,suitable for me',
    approved_message:
      "Fund mix suitability depends on factors such as investment time horizon, risk tolerance, and overall financial goals. A full financial needs analysis with a representative or licensed adviser is needed to match these factors to an individual's specific situation.",
    plain_english:
      "The right fund mix really depends on how long you're investing for and how comfortable you are with ups and downs. Let's go through your goals together so we can see what fits you.",
  },
  {
    product_type: PRODUCT_TYPES.ILP,
    topic: 'Comparing two ILPs or funds',
    keywords: 'compare,comparison,which is better,versus,difference between my policies,help me compare,two plan,two fund,two policies',
    approved_message:
      "When comparing ILPs or sub-funds, useful reference points include insurance charges, fund risk classification, historical fund performance (not indicative of future returns), and the protection coverage included. A representative can review specific fund fact sheets side by side with the customer.",
    plain_english:
      "Good things to compare are the charges, how risky each fund is, and how much protection cover comes with it. I can pull up the fund fact sheets now and go through them with you side by side.",
  },

  // ---------- Critical illness ----------
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'What conditions are covered',
    keywords: 'critical illness,what is covered,which illnesses,covered conditions,cancer,heart attack,stroke',
    approved_message:
      "This plan pays a lump sum upon diagnosis of a covered critical illness, such as cancer, heart attack or stroke, as defined under the policy's list of covered conditions and their specific diagnostic criteria.",
    plain_english:
      "If you're diagnosed with one of the major illnesses listed in the policy — like cancer, heart attack or stroke — you get a one-time payout, based on how the policy defines that illness.",
  },
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'Survival / waiting period',
    keywords: 'survival period,waiting period,how soon,claim timing',
    approved_message:
      "Some conditions are subject to a survival period, requiring the life assured to survive a specified number of days after diagnosis before a claim is payable.",
    plain_english:
      "For some illnesses, you need to survive a certain number of days after diagnosis before the payout is made — this is stated in the policy.",
  },
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'Early / intermediate stage coverage',
    keywords: 'early stage,intermediate stage,multi-pay,recurring claim',
    approved_message:
      "Certain plans provide additional payouts for early or intermediate stage conditions, subject to the specific definitions and claim limits in the policy contract.",
    plain_english:
      "Some plans also pay out for earlier stages of an illness, not just the advanced stage — this depends on the exact plan.",
  },
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'Exclusions',
    keywords: 'exclusion,pre-existing,not covered,what is not covered',
    approved_message:
      "Pre-existing conditions and specific exclusions are listed in your policy contract and product summary. Please refer to these documents for the full list.",
    plain_english:
      "There are some conditions the plan won't pay out for — these are listed clearly in your policy documents.",
  },
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'General factors when choosing critical illness cover',
    keywords:
      'what plan is suitable,which plan should i get,what should i choose,suitable plan,recommend a plan,best plan for me,which one should i pick,suitable for me,how much coverage do i need',
    approved_message:
      "Critical illness coverage suitability depends on factors such as family medical history, existing savings, income replacement needs, and budget. A full financial needs analysis with a representative or licensed adviser is needed to match these factors to an individual's specific situation.",
    plain_english:
      "How much cover makes sense depends on things like family health history, your savings, and what you'd need to replace your income if you fell ill. Let's go through your situation together so we can see what fits you.",
  },
  {
    product_type: PRODUCT_TYPES.CI,
    topic: 'Comparing two critical illness policies',
    keywords: 'compare,comparison,which is better,versus,difference between my policies,help me compare,two plan,two policies,two insurance plan',
    approved_message:
      "When comparing critical illness policies, useful reference points include the list of covered conditions, whether early/intermediate stage conditions are included, survival period, payout structure (single vs multi-pay), and premium. A representative can review specific policy illustrations side by side with the customer.",
    plain_english:
      "Good things to compare are: which illnesses are covered, whether earlier stages are included, how soon you can claim, and the price. I can pull up your two policies now and we can go through them side by side.",
  },

  // ---------- Integrated Shield Plans ----------
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'ISP vs MediShield Life',
    keywords: 'integrated shield,medishield,difference,what is isp',
    approved_message:
      "An Integrated Shield Plan combines MediShield Life with an additional private insurance component, offered by a private insurer, to provide higher coverage limits for hospitalisation in private hospitals or higher-class wards.",
    plain_english:
      "MediShield Life is the basic national plan everyone has. An Integrated Shield Plan adds extra private coverage on top, for higher claim limits or a nicer ward.",
  },
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'Riders and co-payment',
    keywords: 'rider,co-payment,copay,deductible,out of pocket',
    approved_message:
      "Riders can reduce your co-payment amount, subject to the deductible and co-insurance terms set out in your policy and any applicable MOH co-payment requirements.",
    plain_english:
      "An add-on called a 'rider' can lower how much you pay out of pocket, but you'll usually still pay a small share, as required by MOH rules.",
  },
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'Pre-authorisation for planned treatment',
    keywords: 'preauthorisation,pre-authorisation,panel doctor,claim approval',
    approved_message:
      "Pre-authorisation may be required for planned treatments. Please refer to your insurer's claims procedure and panel list for further details.",
    plain_english:
      "For planned, non-emergency treatments, it's worth checking with the insurer first so the claim goes smoothly.",
  },
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'Premiums increase with age',
    keywords: 'premium increase,age band,renewal premium',
    approved_message:
      "Premiums for Integrated Shield Plans are reviewed periodically and generally increase as you move into higher age bands, as disclosed in the insurer's premium table.",
    plain_english:
      "As you get older, premiums for this type of plan typically go up — insurers publish a table showing this by age band.",
  },
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'General factors when choosing ward class or rider',
    keywords:
      'what plan is suitable,which plan should i get,what should i choose,suitable plan,recommend a plan,best plan for me,which ward,should i upgrade,suitable for me',
    approved_message:
      "Ward class and rider suitability depends on factors such as budget, preference for private or public hospital care, and willingness to take on co-payment. A full financial needs analysis with a representative or licensed adviser is needed to match these factors to an individual's specific situation.",
    plain_english:
      "Whether to upgrade your ward or add a rider depends on your budget and how much co-payment you're comfortable with. Let's go through your situation together so we can see what fits you.",
  },
  {
    product_type: PRODUCT_TYPES.ISP,
    topic: 'Comparing two Integrated Shield Plans',
    keywords: 'compare,comparison,which is better,versus,difference between my policies,help me compare,two plan,two policies,two insurance plan',
    approved_message:
      "When comparing Integrated Shield Plans, useful reference points include ward class coverage, annual claim limit, deductible, co-insurance, and premium. A representative can review specific policy illustrations side by side with the customer.",
    plain_english:
      "Good things to compare are: which ward class is covered, the yearly claim limit, how much you pay before claims kick in, and the price. I can pull up your two policies now and we can go through them side by side.",
  },

  // ---------- Retirement / CPF LIFE ----------
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'What is CPF LIFE',
    keywords: 'cpf life,what is cpf life,retirement payout,monthly payout',
    approved_message:
      "CPF LIFE is a national longevity insurance annuity scheme that provides Singapore Citizens and Permanent Residents with a monthly payout for as long as they live, starting from their payout eligibility age.",
    plain_english:
      "CPF LIFE gives you a monthly income for life once you reach your payout age, so you won't run out of retirement income no matter how long you live.",
  },
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'CPF LIFE payout plan options',
    keywords: 'standard plan,basic plan,escalating plan,payout plan',
    approved_message:
      "CPF LIFE offers different payout plan options, each with different monthly payout amounts and bequest amounts, as published by the CPF Board.",
    plain_english:
      "There are a few payout options — some give a steady amount, some start lower but increase over time, and they leave different amounts behind for your family.",
  },
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'Private annuities alongside CPF LIFE',
    keywords: 'private annuity,supplement retirement,additional retirement income',
    approved_message:
      "Private retirement annuities can supplement CPF LIFE payouts. Terms, payout structures and guarantees vary by provider and product, as set out in the policy contract.",
    plain_english:
      "Some people also take a private annuity for extra retirement income on top of CPF LIFE — but terms vary a lot between products, so it's worth reading the details.",
  },
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'Retirement Sum tiers',
    keywords: 'retirement sum,full retirement sum,basic retirement sum,how much do i need',
    approved_message:
      "The CPF Retirement Sum required depends on the cohort year and chosen retirement sum tier, as published annually by the CPF Board.",
    plain_english:
      "The amount you're expected to set aside for retirement is set by CPF and adjusted slightly each year — the exact figure depends on your cohort year.",
  },
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'General factors when choosing a payout plan',
    keywords:
      'what plan is suitable,which plan should i get,what should i choose,suitable plan,recommend a plan,best plan for me,which payout plan,suitable for me',
    approved_message:
      "Payout plan suitability depends on factors such as desired monthly payout amount, bequest preference for beneficiaries, and other retirement income sources. A full financial needs analysis with a representative or licensed adviser is needed to match these factors to an individual's specific situation.",
    plain_english:
      "Which payout option suits you depends on how much monthly income you want versus how much you'd like to leave behind for family. Let's go through your situation together so we can see what fits you.",
  },
  {
    product_type: PRODUCT_TYPES.RETIREMENT,
    topic: 'Comparing retirement options',
    keywords: 'compare,comparison,which is better,versus,difference between my policies,help me compare,two plan,two policies,cpf life vs',
    approved_message:
      "When comparing CPF LIFE with a private annuity or between CPF LIFE payout plans, useful reference points include monthly payout amount, start age, bequest amount, and guarantee structure. A representative can review specific figures side by side with the customer.",
    plain_english:
      "Good things to compare are: the monthly amount, when payouts start, what's left for your family, and what's guaranteed. I can pull up the numbers now and we can go through them side by side.",
  },
];

module.exports = { knowledgeBase, PRODUCT_TYPES };
