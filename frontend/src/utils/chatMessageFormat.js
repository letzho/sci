/**
 * Formats system/activity messages (game survey, quiz) for chat display.
 * Raw JSON is kept in DB for the rep audit trail — not shown verbatim in UI.
 */

const GAME_LABELS = {
  minesweeper: 'Minesweeper',
  snake: 'Snake',
  candy_crush: 'Candy Crush',
  pop_blast: 'Pop Blast',
  tetris: 'Tetris',
};

/** Hidden from customer chat — they already saw the game overlay. */
export const CLIENT_HIDDEN_KINDS = new Set(['game_survey', 'quiz', 'invite', 'draft', 'transcript']);

export function parseActivityPayload(message) {
  if (!message?.content) return null;
  if (!['game_survey', 'quiz', 'invite'].includes(message.kind)) return null;
  try {
    return JSON.parse(message.content);
  } catch {
    return null;
  }
}

export function formatActivityForChat(message) {
  const data = parseActivityPayload(message);
  if (!data) return null;

  if (message.kind === 'game_survey') {
    if (data.action === 'started') {
      return {
        title: 'Game sent',
        body: data.title || 'Play & learn',
        tone: 'info',
      };
    }
    if (data.action === 'completed') {
      const game = GAME_LABELS[data.gameChoice] || data.gameChoice || 'mini-game';
      const cards = data.cardsViewed || 0;
      return {
        title: 'Game completed',
        body: `Played ${game} · discovered ${cards} fact${cards === 1 ? '' : 's'}`,
        tone: 'success',
      };
    }
  }

  if (message.kind === 'quiz') {
    if (data.action === 'started') {
      return { title: 'Quiz sent', body: data.title || 'Warm-up quiz', tone: 'info' };
    }
    if (data.action === 'submitted') {
      return {
        title: 'Quiz submitted',
        body: `Score: ${data.score ?? '?'}/${data.total ?? '?'}`,
        tone: 'success',
      };
    }
  }

  if (message.kind === 'invite' && data.subject) {
    return { title: 'Meeting invite', body: data.subject, tone: 'info' };
  }

  return null;
}

export function enrichChatMessage(message) {
  const activity = formatActivityForChat(message);
  if (activity) {
    return { ...message, activity, hideFromClient: CLIENT_HIDDEN_KINDS.has(message.kind) };
  }
  return message;
}

export function filterClientMessages(messages) {
  return messages
    .map(enrichChatMessage)
    .filter((m) => !CLIENT_HIDDEN_KINDS.has(m.kind));
}

export function mapConversationMessages(messages, { forClient = false } = {}) {
  const mapped = (messages || []).map((m) => enrichChatMessage(m));
  if (forClient) {
    return mapped.filter((m) => !CLIENT_HIDDEN_KINDS.has(m.kind));
  }
  return mapped;
}
