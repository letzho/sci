/** Returns true when the JWT is missing, malformed, or past its expiry. */
export function isTokenExpired(token) {
  if (!token) return true;
  try {
    const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!base64) return true;
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
