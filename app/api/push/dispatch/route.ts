import { dispatchPush } from "@/lib/push/send";

/**
 * Sends pending pushes (push_outbox). Pinged by diner pages right after a
 * waiter call or an order (their writes go straight to the database), and by
 * the nightly job. Open on purpose: it only delivers rows that already exist,
 * each exactly once.
 */
export async function POST() {
  const sent = await dispatchPush();
  return Response.json({ sent });
}
