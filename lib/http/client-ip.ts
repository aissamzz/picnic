import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP behind Coolify/Traefik. Used only as a rate-limit key. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Per-IP limits are skipped for loopback (local dev, e2e) and unknown IPs.
 * They stay loose anyway: Algerian mobile carriers put many users behind one IP.
 */
export function isIpLimited(ip: string): boolean {
  return !["unknown", "127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
}
