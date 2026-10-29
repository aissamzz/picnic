import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./endpoint";
import { buildPush } from "./payload";

describe("push endpoints", () => {
  it.each([
    ["https://fcm.googleapis.com/fcm/send/abc", true],
    ["https://updates.push.services.mozilla.com/wpush/v2/abc", true],
    ["https://web.push.apple.com/QGx", true],
    ["https://wns2-par02p.notify.windows.com/w/?token=x", true],
    ["https://evil.example.com/fcm.googleapis.com", false],
    ["https://fcm.googleapis.com.evil.com/x", false],
    ["http://fcm.googleapis.com/x", false],
    ["https://fcm.googleapis.com:8443/x", false],
    ["https://127.0.0.1:9999/push", false],
    ["not a url", false],
  ])("%s -> %s", (url, ok) => expect(isAllowedPushEndpoint(url)).toBe(ok));

  it("allows localhost only when asked (E2E)", () => {
    expect(isAllowedPushEndpoint("https://127.0.0.1:9999/push", true)).toBe(true);
    expect(isAllowedPushEndpoint("http://127.0.0.1:9999/push", true)).toBe(false);
    expect(isAllowedPushEndpoint("https://10.0.0.5/push", true)).toBe(false);
  });
});

describe("push payloads", () => {
  it("waiter call and bill, in both languages", () => {
    const call = buildPush({ id: 1, kind: "waiter_call", payload: { id: "c1", call: "waiter", table: "Table 4" } }, "fr", "Roma")!;
    expect(call).toMatchObject({ title: "Table 4 : appel serveur", body: "Roma", url: "/app/appels", requireInteraction: true, urgency: "high", ttl: 300 });
    const bill = buildPush({ id: 2, kind: "waiter_call", payload: { id: "c2", call: "bill", table: "Table 4" } }, "ar", "Roma")!;
    expect(bill.title).toBe("Table 4: طلب الحساب");
    expect(bill.lang).toBe("ar");
  });

  it("order with total and mode", () => {
    const o = buildPush({ id: 3, kind: "order", payload: { id: "o1", public_id: "K7Q2PD", mode: "delivery", total: 2500, customer: "Nadia" } }, "fr", "Roma")!;
    expect(o.title).toMatch(/^Nouvelle commande K7Q2PD · 2\s500\sDA$/);
    expect(o.body).toBe("Livraison · Nadia");
  });

  it("owner notifications reuse the notification text; unknown kinds are skipped", () => {
    const n = buildPush({ id: 4, kind: "notification", payload: { id: "n1", kind: "payment_approved", payload: { paid_until: "2027-01-15T00:00:00Z" } } }, "fr", "Roma")!;
    expect(n.body).toBe("Paiement validé. Abonnement actif jusqu'au 15 janvier 2027.");
    expect(n.url).toBe("/app/abonnement");
    expect(buildPush({ id: 5, kind: "notification", payload: { kind: "something_else" } }, "fr", "Roma")).toBeNull();
    expect(buildPush({ id: 6, kind: "weird", payload: {} }, "fr", "Roma")).toBeNull();
  });
});
