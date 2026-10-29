/**
 * The server POSTs to subscription endpoints, so only real push services are
 * accepted (no SSRF through a forged subscription). Local endpoints are allowed
 * for E2E only (PUSH_ALLOW_LOCAL_ENDPOINTS=1, never in production).
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

export function isAllowedPushEndpoint(endpoint: string, allowLocal = false): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (allowLocal && isLocal(url)) return true;
  return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((h) => h.test(url.hostname));
}

function isLocal(url: URL) {
  return url.protocol === "https:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
}

/** True for the E2E mock push service (self-signed certificate on localhost). */
export function isLocalPushEndpoint(endpoint: string): boolean {
  try {
    return isLocal(new URL(endpoint));
  } catch {
    return false;
  }
}

export function allowLocalEndpoints(): boolean {
  return process.env.PUSH_ALLOW_LOCAL_ENDPOINTS === "1" && process.env.NODE_ENV !== "production";
}
