/**
 * When the app is opened from another device via a LAN IP (e.g. http://172.27.49.255:5173),
 * API/socket calls must target that same host — not localhost, which would mean the phone itself.
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

export function resolveApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return `http://${resolveBackendHost()}:4000/api`;
}

export function resolveSocketUrl() {
  const envUrl = import.meta.env.VITE_SOCKET_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return `http://${resolveBackendHost()}:4000`;
}
