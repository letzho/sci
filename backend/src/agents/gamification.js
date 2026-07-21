const db = require('../db/connection');

/**
 * Gamification layer for the Agent Console.
 *
 * Turns the same real usage data behind the Impact dashboard into a
 * level/XP/streak/badge system, so reps get a lightweight, motivating sense
 * of progress while they work - never anything fabricated, and never shown
 * to the customer. Every figure here is derived from live DB activity
 * scoped to the logged-in agent.
 */

const LEVELS = [
  { level: 1, title: 'New Rep', minXp: 0 },
  { level: 2, title: 'Rising Rep', minXp: 100 },
  { level: 3, title: 'Confident Advisor', minXp: 300 },
  { level: 4, title: 'Trusted Advisor', minXp: 600 },
  { level: 5, title: 'Client Champion', minXp: 1000 },
  { level: 6, title: 'SCI Certified Pro', minXp: 1500 },
  { level: 7, title: 'Master Advisor', minXp: 2200 },
];

function levelForXp(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l;
    else break;
  }
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const xpIntoLevel = xp - current.minXp;
  const xpForNextLevel = next ? next.minXp - current.minXp : null;
  const progressPct = next ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100)) : 100;
  return {
    level: current.level,
    levelTitle: current.title,
    xpIntoLevel,
    xpForNextLevel,
    progressPct,
    nextTitle: next ? next.title : null,
  };
}

/**
 * Longest run of the most recent conversations with zero high-severity
 * compliance flags, counting back from the latest session. Rewards
 * consistently clean, well-guided conversations - not just volume.
 */
async function computeCleanStreak(agentId) {
  const rows = await db
    .prepare(
      `SELECT c.id,
        (SELECT COUNT(*) FROM guidance_events g
          WHERE g.conversation_id = c.id AND g.guidance_type = 'compliance_flag' AND g.severity = 'high'
        ) AS highFlags
       FROM conversations c
       WHERE c.agent_id = ?
       ORDER BY c.started_at DESC`
    )
    .all(agentId);

  let streak = 0;
  for (const row of rows) {
    if (row.highFlags > 0) break;
    streak += 1;
  }
  return streak;
}

async function computeGamification(agentId) {
  const totalConversations = (await db.prepare(`SELECT COUNT(*) AS n FROM conversations WHERE agent_id = ?`).get(agentId)).n;
  const totalTalkingPoints = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM guidance_events g
       JOIN conversations c ON c.id = g.conversation_id
       WHERE c.agent_id = ? AND g.guidance_type = 'talking_point'`
    )
    .get(agentId)).n;
  const draftsReviewed = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.agent_id = ? AND m.kind = 'draft'`
    )
    .get(agentId)).n;
  const byChannelRows = await db
    .prepare(`SELECT channel, COUNT(*) AS n FROM conversations WHERE agent_id = ? GROUP BY channel`)
    .all(agentId);
  const byChannel = byChannelRows.reduce((acc, r) => ({ ...acc, [r.channel]: r.n }), { face_to_face: 0, virtual_call: 0, chat: 0 });
  const cleanStreak = await computeCleanStreak(agentId);
  const channelsUsed = Object.values(byChannel).filter((n) => n > 0).length;

  const xp = totalConversations * 25 + totalTalkingPoints * 4 + draftsReviewed * 3 + cleanStreak * 5;
  const levelInfo = levelForXp(xp);

  const badges = [
    {
      id: 'first_session',
      label: 'First Session',
      description: 'Completed your first guided session.',
      icon: 'rocket',
      earned: totalConversations >= 1,
      progress: Math.min(totalConversations, 1),
      goal: 1,
    },
    {
      id: 'channel_explorer',
      label: 'Channel Explorer',
      description: 'Used all three channels - face-to-face, virtual call and chat.',
      icon: 'compass',
      earned: channelsUsed >= 3,
      progress: channelsUsed,
      goal: 3,
    },
    {
      id: 'ten_sessions',
      label: 'Ten Sessions Strong',
      description: 'Completed 10 guided sessions.',
      icon: 'flame',
      earned: totalConversations >= 10,
      progress: Math.min(totalConversations, 10),
      goal: 10,
    },
    {
      id: 'talking_point_pro',
      label: 'Talking Point Pro',
      description: 'Received 25 approved talking points from live guidance.',
      icon: 'sparkles',
      earned: totalTalkingPoints >= 25,
      progress: Math.min(totalTalkingPoints, 25),
      goal: 25,
    },
    {
      id: 'draft_reviewer',
      label: 'Careful Reviewer',
      description: 'Reviewed 10 AI-drafted chat replies before sending.',
      icon: 'shield',
      earned: draftsReviewed >= 10,
      progress: Math.min(draftsReviewed, 10),
      goal: 10,
    },
    {
      id: 'clean_streak_5',
      label: 'Compliance Clean x5',
      description: '5 sessions in a row with no high-risk compliance flags.',
      icon: 'badge-check',
      earned: cleanStreak >= 5,
      progress: Math.min(cleanStreak, 5),
      goal: 5,
    },
  ];

  return {
    xp,
    cleanStreak,
    badges,
    badgesEarned: badges.filter((b) => b.earned).length,
    badgesTotal: badges.length,
    ...levelInfo,
  };
}

module.exports = { computeGamification };
