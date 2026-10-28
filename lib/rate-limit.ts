import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Fixed-window limiter backed by Postgres (public.hit_rate_limit).
 * Swap the body for an Upstash/Redis call without touching callers.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createServiceClient().rpc("hit_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}
