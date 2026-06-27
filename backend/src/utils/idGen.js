const crypto = require('crypto');

/**
 * Generates a compact, URL-safe unique id.
 * Uses Node's built-in crypto (no extra dependency needed).
 */
function genId(prefix = '') {
  const raw = crypto.randomUUID().replace(/-/g, '');
  return prefix ? `${prefix}_${raw}` : raw;
}

/**
 * Generates a short, human-friendly session/room code (e.g. for display),
 * not used for security - only for demo readability.
 */
function genShortCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[crypto.randomInt(0, chars.length)];
  }
  return out;
}

module.exports = { genId, genShortCode };
