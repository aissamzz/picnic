import { timingSafeEqual } from "node:crypto";
import { dispatchPush } from "@/lib/push/send";
import { PUBLIC_BUCKET } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Nightly job (Coolify scheduled task, see DEPLOY.md):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://liinky.app/api/cron/nightly
 * 1. Subscription tick (also run by pg_cron where available).
 * 2. Maintenance: expire codes, purge rate limits, delete old import sources and photos of deleted dishes.
 * Idempotent: running it twice changes nothing.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const { data: restaurants, error } = await service.rpc("run_subscription_tick");
  if (error) {
    console.error("[cron] subscription tick failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }

  const { data: m, error: mErr } = await service.rpc("run_maintenance");
  if (mErr || !m) {
    console.error("[cron] maintenance failed", mErr);
    return Response.json({ error: "failed" }, { status: 500 });
  }
  const report = m as { codes: number; rate_limits: number; import_paths: string[]; photo_paths: string[] };
  const remove = async (bucket: string, paths: string[]) => {
    for (let i = 0; i < paths.length; i += 100) {
      const { error: e } = await service.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (e) console.error(`[cron] could not delete from ${bucket}`, e);
    }
  };
  await remove("imports", report.import_paths);
  await remove(PUBLIC_BUCKET, report.photo_paths);

  // Reminders created by the tick (trial ending, renewal due…).
  const pushes = await dispatchPush(200);

  return Response.json({
    ok: true,
    pushes,
    restaurants,
    codes: report.codes,
    rateLimits: report.rate_limits,
    files: report.import_paths.length + report.photo_paths.length,
  });
}
