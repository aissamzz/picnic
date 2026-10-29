import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Nightly subscription tick for hosts without pg_cron (Coolify scheduled task):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://liinky.app/api/cron/subscriptions
 * Idempotent: running it twice changes nothing.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await createServiceClient().rpc("run_subscription_tick");
  if (error) {
    console.error("[cron] subscription tick failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
  return Response.json({ ok: true, restaurants: data });
}
