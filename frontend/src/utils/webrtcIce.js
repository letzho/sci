/** STUN — helps peers discover public addresses. */
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

/**
 * Public TURN relays for cross-network video (different WiFi / mobile data).
 * Demo-grade only — for production use Metered/Twilio and set VITE_ICE_SERVERS.
 */
const PUBLIC_TURN_SERVERS = [
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayprojectsecret',
  },
  {
    urls: 'turn:numb.viagenie.ca',
    username: 'webrtc@live.com',
    credential: 'muazkh',
  },
  {
    urls: [
      'turn:turn.anyfirewall.com:443?transport=tcp',
      'turn:turn.anyfirewall.com:443?transport=udp',
    ],
    username: 'webrtc',
    credential: 'webrtc',
  },
];

function isLanOrLocalHost() {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

/** @param {{ forceRelay?: boolean }} opts */
export function getIceServers({ forceRelay = false } = {}) {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      console.warn('[webrtcIce] Invalid VITE_ICE_SERVERS JSON');
    }
  }

  if (isLanOrLocalHost()) return STUN_SERVERS;
  return [...STUN_SERVERS, ...PUBLIC_TURN_SERVERS];
}

/** @param {{ forceRelay?: boolean }} opts */
export function getPeerConnectionConfig({ forceRelay = false } = {}) {
  const config = {
    iceServers: getIceServers({ forceRelay }),
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
  };
  if (forceRelay) config.iceTransportPolicy = 'relay';
  return config;
}

export function isProductionWebRtc() {
  return !isLanOrLocalHost();
}
