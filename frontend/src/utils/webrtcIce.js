import api from '../api/client';

/**
 * WebRTC ICE server configuration.
 *
 * For a real cross-network call (rep on office WiFi, client on mobile data) a
 * TURN relay is required — STUN alone can't punch through symmetric NATs. This
 * module resolves ICE servers in priority order:
 *
 *   1. Backend TURN endpoint   — GET /tools/ice-servers, which fetches fresh
 *      Metered relays server-side (the Metered secret key stays on the backend,
 *      never in this browser bundle). Recommended; free 50GB/mo tier.
 *   2. Static JSON override    — VITE_ICE_SERVERS (a full iceServers array).
 *   3. STUN + last-resort TURN — public relays (unreliable, LAN/dev only).
 *
 * The credentials are fetched once and cached. Call prefetchIceServers() early
 * (on call-screen mount) so the relays are ready by the time negotiation
 * starts; getIceServers() stays synchronous and returns the best available set.
 */

/** STUN — helps peers discover their public address (free, always safe). */
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * Last-resort public TURN (openrelay). Frequently rate-limited — only used when
 * no Metered/static config is provided. Configure Metered for a reliable demo.
 */
const FALLBACK_TURN_SERVERS = [
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayprojectsecret',
  },
];

let cachedIceServers = null;
let inflightFetch = null;

function parseStaticOverride() {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    console.warn('[webrtcIce] Invalid VITE_ICE_SERVERS JSON — ignoring');
  }
  return null;
}

function isLanOrLocalHost() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/**
 * Fetch TURN credentials from the backend (once), then cache. The backend
 * holds the Metered secret and returns a ready iceServers array (or null when
 * Metered isn't configured). Falls back to the static override or STUN +
 * public TURN. Safe to call repeatedly — subsequent calls return the cache.
 * @returns {Promise<Array>} resolved iceServers array
 */
export function prefetchIceServers() {
  if (cachedIceServers) return Promise.resolve(cachedIceServers);
  if (inflightFetch) return inflightFetch;

  const staticOverride = parseStaticOverride();
  if (staticOverride) {
    cachedIceServers = staticOverride;
    return Promise.resolve(cachedIceServers);
  }

  inflightFetch = api
    .get('/tools/ice-servers')
    .then((res) => {
      const servers = res.data?.iceServers;
      if (Array.isArray(servers) && servers.length) {
        // Backend returns Metered STUN + TURN; keep Google STUN as an extra.
        cachedIceServers = [...STUN_SERVERS, ...servers];
      } else {
        // No Metered configured — STUN only on LAN, + public TURN off-LAN.
        cachedIceServers = isLanOrLocalHost() ? STUN_SERVERS : [...STUN_SERVERS, ...FALLBACK_TURN_SERVERS];
      }
      return cachedIceServers;
    })
    .catch((err) => {
      console.warn('[webrtcIce] TURN credential fetch failed — using fallback:', err.message);
      cachedIceServers = isLanOrLocalHost() ? STUN_SERVERS : [...STUN_SERVERS, ...FALLBACK_TURN_SERVERS];
      return cachedIceServers;
    })
    .finally(() => {
      inflightFetch = null;
    });

  return inflightFetch;
}

/** Synchronous best-available ICE servers (cache if prefetched, else fallback). */
export function getIceServers() {
  if (cachedIceServers) return cachedIceServers;
  const staticOverride = parseStaticOverride();
  if (staticOverride) return staticOverride;
  return isLanOrLocalHost() ? STUN_SERVERS : [...STUN_SERVERS, ...FALLBACK_TURN_SERVERS];
}

/** @param {{ forceRelay?: boolean }} opts */
export function getPeerConnectionConfig({ forceRelay = false } = {}) {
  // Note: no bundlePolicy 'max-bundle' — it rejects an offer that has no media
  // (BUNDLE group), which happens if createOffer runs before camera/mic tracks
  // are added. The default 'balanced' policy negotiates the bundle safely.
  const config = {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 10,
  };
  if (forceRelay) config.iceTransportPolicy = 'relay';
  return config;
}

/** True when the app is served from a public host (i.e. a real cross-network call). */
export function isProductionWebRtc() {
  return !isLanOrLocalHost();
}

/** True once we have at least one TURN relay available (Metered or fallback). */
export function hasTurnRelay() {
  return getIceServers().some((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((u) => typeof u === 'string' && u.startsWith('turn'));
  });
}
