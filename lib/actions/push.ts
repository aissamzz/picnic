"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireRestaurant, requireSession } from "@/lib/auth/session";
import { allowLocalEndpoints, isAllowedPushEndpoint } from "@/lib/push/endpoint";
import { pushConfigured, sendTestPush } from "@/lib/push/send";
import { createClient } from "@/lib/supabase/server";

const subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(8).max(100) }),
});

/** This phone receives the restaurant's pushes (owners and staff alike). */
export async function savePushSubscription(input: unknown, locale: string, userAgent: string): Promise<ActionResult> {
  const restaurant = await requireRestaurant();
  const parsed = subscription.safeParse(input);
  if (!parsed.success || !isAllowedPushEndpoint(parsed.data.endpoint, allowLocalEndpoints())) return fail("owner.push.error");
  const { error } = await (await createClient()).rpc("save_push_subscription", {
    p_restaurant_id: restaurant.id,
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_locale: locale,
    p_user_agent: userAgent.slice(0, 300),
  });
  return error ? fail("owner.push.error") : { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  await requireSession();
  await (await createClient()).from("push_subscriptions").delete().eq("endpoint", endpoint.slice(0, 1000));
  return { ok: true };
}

export async function sendPushTestAction(): Promise<ActionResult<{ sent: number }>> {
  const { user } = await requireSession();
  const restaurant = await requireRestaurant();
  if (!pushConfigured()) return fail("owner.push.unavailable");
  const sent = await sendTestPush(user.id, restaurant.id);
  return { ok: true, data: { sent } };
}
