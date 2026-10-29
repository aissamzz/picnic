import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { RequestListener } from "node:http";
import { createServer, type Server } from "node:https";
import path from "node:path";
import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { db } from "./db";
import { createRestaurant, rand, randomPhone, signUp } from "./helpers";

// http_ece is web-push's own encryption library: decrypt exactly what a phone would.
const ece = createRequire(require.resolve("web-push"))("http_ece") as {
  decrypt: (buf: Buffer, params: { version: string; privateKey: ReturnType<typeof createECDH>; authSecret: Buffer }) => Buffer;
};

type Received = { headers: Record<string, string | string[] | undefined>; body: Buffer };

const tls = { key: readFileSync(path.join(__dirname, "fixtures", "push-mock.key")), cert: readFileSync(path.join(__dirname, "fixtures", "push-mock.crt")) };
const serve = (handler: RequestListener) => createServer(tls, handler);

/** A stand-in push service over HTTPS (the dispatcher may post to localhost outside production, for this test only). */
async function mockPushService(): Promise<{ url: string; received: Received[]; close: () => Promise<void> }> {
  const received: Received[] = [];
  const server: Server = serve((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(201).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `https://127.0.0.1:${port}/push/${rand()}`, received, close: () => new Promise((r) => server.close(() => r())) };
}

test("a waiter call reaches the owner's phone as an encrypted push", async ({ page, browser }) => {
  const phone = randomPhone();
  await signUp(page, phone);
  await createRestaurant(page, `Push ${rand()}`);
  const { data: r } = await db().from("restaurants").select("id, slug, name").order("created_at", { ascending: false }).limit(1).single();
  const { data: owner } = await db().from("restaurant_members").select("user_id").eq("restaurant_id", r!.id).eq("role", "owner").single();
  await db().from("tables").insert({ restaurant_id: r!.id, code: "T4", label: "Table 4" });

  // The phone's keys, as the browser would create them on subscribe.
  const keys = createECDH("prime256v1");
  keys.generateKeys();
  const auth = randomBytes(16);
  const push = await mockPushService();
  try {
    await db()
      .from("push_subscriptions")
      .insert({ user_id: owner!.user_id, restaurant_id: r!.id, endpoint: push.url, p256dh: keys.getPublicKey("base64url"), auth: auth.toString("base64url"), locale: "fr" });

    const diner = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await diner.goto(`/${r!.slug}-menu?t=t4&lang=fr`);
    await diner.getByRole("button", { name: "Appeler" }).click();
    await diner.getByRole("button", { name: "Demander l'addition" }).click();
    await expect(diner.getByText("C'est noté, quelqu'un arrive.")).toBeVisible();

    await expect.poll(() => push.received.length, { timeout: 15_000 }).toBe(1);
    const req = push.received[0];
    expect(req.headers["content-encoding"]).toBe("aes128gcm");
    expect(req.headers.ttl).toBe("300");
    expect(req.headers.urgency).toBe("high");
    expect(String(req.headers.authorization)).toMatch(/^vapid t=/);
    const message = JSON.parse(ece.decrypt(req.body, { version: "aes128gcm", privateKey: keys, authSecret: auth }).toString("utf8"));
    expect(message).toMatchObject({ title: "Table 4 : demande l'addition", body: r!.name, url: "/app/appels", requireInteraction: true, lang: "fr" });

    // Sent once: another dispatch finds nothing.
    const again = await (await page.request.post("/api/push/dispatch")).json();
    expect(again.sent).toBe(0);
  } finally {
    await push.close();
  }
});

test("a gone subscription (410) is removed", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Push gone ${rand()}`);
  const { data: r } = await db().from("restaurants").select("id").order("created_at", { ascending: false }).limit(1).single();
  const { data: owner } = await db().from("restaurant_members").select("user_id").eq("restaurant_id", r!.id).eq("role", "owner").single();
  const keys = createECDH("prime256v1");
  keys.generateKeys();
  const server = serve((_, res) => res.writeHead(410).end());
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const endpoint = `https://127.0.0.1:${(server.address() as { port: number }).port}/gone`;
  try {
    await db().from("push_subscriptions").insert({ user_id: owner!.user_id, restaurant_id: r!.id, endpoint, p256dh: keys.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") });
    await db().from("waiter_calls").insert({ restaurant_id: r!.id, kind: "waiter" });
    await page.request.post("/api/push/dispatch");
    const { count } = await db().from("push_subscriptions").select("id", { count: "exact", head: true }).eq("endpoint", endpoint);
    expect(count).toBe(0);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

test("owners and staff see the notification switch; it explains when push is unavailable", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Push UI ${rand()}`);
  await page.goto("/app/notifications");
  await expect(page.getByText("Notifications sur ce téléphone")).toBeVisible();
  // Headless browsers deny notifications and the dev server has no service worker:
  // the card says why instead of showing a dead button.
  await expect(page.getByRole("status").filter({ hasText: /bloquées|ne prend pas en charge/ })).toBeVisible();
});
