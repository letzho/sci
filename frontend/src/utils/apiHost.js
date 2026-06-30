/**
 * When the app is opened from another device via a LAN IP (e.g. http://172.27.49.255:5173),
 * API/socket calls must target that same host — not localhost, which would mean the phone itself.
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

function warnMissingProductionEnv() {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (isLocal || import.meta.env.VITE_API_URL) return;
  console.error(
    '[ClarityAI] VITE_API_URL is not set. On Vercel, add Environment Variables pointing to your Render backend, then redeploy.'
  );
}

export function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  warnMissingProductionEnv();
  return `http://${resolveBackendHost()}:4000/api`;
}

export function resolveSocketUrl() {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  warnMissingProductionEnv();
  return `http://${resolveBackendHost()}:4000`;
}
