const PLACEHOLDER_HOST_RE = /YOUR-SERVICE|example\.com|your-app|your-service/i;

function isLanDevHost(hostname) {
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

function isLocalPageHost(hostname) {
  return !hostname || hostname === 'localhost' || hostname === '127.0.0.1' || isLanDevHost(hostname);
}

function parseEnvUrl(raw, label) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (PLACEHOLDER_HOST_RE.test(url.hostname)) {
      console.error(
        `[ClarityAI] ${label} still uses a placeholder host (${url.hostname}). Set your real Render URL in Vercel env vars, then redeploy.`
      );
      return null;
    }
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    console.error(`[ClarityAI] ${label} is not a valid URL: ${raw}`);
    return null;
  }
}

/**
 * When the app is opened from another device via a LAN IP (e.g. http://172.27.49.255:5173),
 * route API/socket through the Vite dev server (proxied to :4000) so the phone does not
 * need direct access to port 4000 or Windows firewall rules for the backend.
 *
 * On Vercel/production you MUST set VITE_API_URL and VITE_SOCKET_URL to your Render backend.
 */
export function resolveBackendHost() {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return hostname;
    }
  }

  const envApi = import.meta.env.VITE_API_URL;
  if (envApi) {
    try {
      return new URL(envApi).hostname;
    } catch {
      /* fall through */
    }
  }

  return 'localhost';
}

function devSameOriginUrls() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const { hostname, origin } = window.location;
  if (!isLanDevHost(hostname)) return null;
  return { api: `${origin}/api`, socket: origin };
}

function warnMissingProductionEnv() {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  if (isLocalPageHost(host) || import.meta.env.VITE_API_URL) return;
  console.error(
    '[ClarityAI] VITE_API_URL / VITE_SOCKET_URL are not set. On Vercel, point them at your Render backend (https://YOUR-ACTUAL-SERVICE.onrender.com), then redeploy the frontend.'
  );
}

export function resolveApiUrl() {
  const proxied = devSameOriginUrls();
  if (proxied) return proxied.api;

  const envUrl = parseEnvUrl(import.meta.env.VITE_API_URL, 'VITE_API_URL');
  if (envUrl) return envUrl;
  warnMissingProductionEnv();
  return `http://${resolveBackendHost()}:4000/api`;
}

export function resolveSocketUrl() {
  const proxied = devSameOriginUrls();
  if (proxied) return proxied.socket;

  const envUrl = parseEnvUrl(import.meta.env.VITE_SOCKET_URL, 'VITE_SOCKET_URL');
  if (envUrl) return envUrl;
  warnMissingProductionEnv();
  return `http://${resolveBackendHost()}:4000`;
}
