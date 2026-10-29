import "server-only";
import { Agent } from "node:https";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";
import { allowLocalEndpoints, isAllowedPushEndpoint, isLocalPushEndpoint } from "./endpoint";
import { buildPush, type OutboxItem, type PushMessage } from "./payload";

type Target = { id: string; endpoint: string; p256dh: string; auth: string; locale: string; restaurant_name: string };

let configured: boolean | null = null;
/** VAPID keys from the environment; without them push is simply off. */
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@liinky.app", pub!, priv!);
  return configured;
}

/** Sends one message to one phone. Gone subscriptions are deleted. */
async function deliver(target: Target, message: PushMessage): Promise<boolean> {
  const service = createServiceClient();
  if (!isAllowedPushEndpoint(target.endpoint, allowLocalEndpoints())) {
    await service.from("push_subscriptions").delete().eq("id", target.id);
    return false;
  }
  try {
    const { ttl, urgency, ...body } = message;
    await webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, JSON.stringify(body), {
      TTL: ttl,
      urgency,
      timeout: 8000,
      // E2E mock push service only (never in production, see allowLocalEndpoints).
      ...(allowLocalEndpoints() && isLocalPushEndpoint(target.endpoint) ? { agent: new Agent({ rejectUnauthorized: false }) } : {}),
    });
    await service.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", target.id);
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await service.from("push_subscriptions").delete().eq("id", target.id);
    else console.error("[push] send failed", status ?? e);
    return false;
  }
}

/**
 * Sends everything waiting in push_outbox. Safe to call often and concurrently:
 * each row is claimed once (skip locked). Returns the number of pushes delivered.
 */
export async function dispatchPush(limit = 50): Promise<number> {
  if (!pushConfigured()) return 0;
  const service = createServiceClient();
  const { data: rows, error } = await service.rpc("claim_push_batch", { p_limit: limit });
  if (error) {
    console.error("[push] claim failed", error);
    return 0;
  }
  let sent = 0;
  type Row = { id: number; restaurant_id: string; kind: string; audience: string; payload: unknown };
  for (const row of (rows ?? []) as unknown as Row[]) {
    const { data: targets } = await service.rpc("push_targets", { p_restaurant_id: row.restaurant_id, p_audience: row.audience });
    const item: OutboxItem = { id: row.id, kind: row.kind, payload: (row.payload ?? {}) as Record<string, unknown> };
    const results = await Promise.all(
      (targets ?? []).map((t) => {
        const message = buildPush(item, t.locale === "ar" ? "ar" : "fr", t.restaurant_name);
        return message ? deliver(t, message) : Promise.resolve(false);
      }),
    );
    sent += results.filter(Boolean).length;
  }
  return sent;
}

/** "Send a test" from the settings: straight to this user's phones for this restaurant. */
export async function sendTestPush(userId: string, restaurantId: string): Promise<number> {
  if (!pushConfigured()) return 0;
  const service = createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, locale, restaurants(name)")
    .eq("user_id", userId)
    .eq("restaurant_id", restaurantId);
  const results = await Promise.all(
    (subs ?? []).map((s) => {
      const locale = s.locale === "ar" ? "ar" : "fr";
      const name = (s.restaurants as unknown as { name: string } | null)?.name ?? "";
      const message = buildTestPush(locale, name);
      return deliver({ ...s, restaurant_name: name }, message);
    }),
  );
  return results.filter(Boolean).length;
}

function buildTestPush(locale: "fr" | "ar", restaurantName: string): PushMessage {
  return {
    title: locale === "ar" ? "الإشعارات مفعّلة" : "Notifications activées",
    body: restaurantName,
    url: "/app/notifications",
    tag: "test",
    requireInteraction: false,
    lang: locale,
    ttl: 120,
    urgency: "normal",
  };
}
