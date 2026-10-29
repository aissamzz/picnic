import { createFormatter, createTranslator } from "next-intl";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import { OWNER_NOTIFICATIONS } from "@/lib/notifications";
import { formatPrice } from "@/lib/price";

export type OutboxItem = { id: number; kind: string; payload: Record<string, unknown> };

/** What the service worker shows. */
export type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
  /** Waiter calls stay on screen until handled. */
  requireInteraction: boolean;
  lang: "fr" | "ar";
  ttl: number;
  urgency: "high" | "normal";
};

const MESSAGES = { fr, ar } as const;

/** Builds the notification for one outbox row in the phone's language. Null for unknown kinds. */
export function buildPush(item: OutboxItem, locale: "fr" | "ar", restaurantName: string): PushMessage | null {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "push" });
  const p = item.payload;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (item.kind === "waiter_call") {
    const table = str(p.table) || t("noTable");
    return {
      title: p.call === "bill" ? t("bill", { table }) : t("waiter", { table }),
      body: restaurantName,
      url: "/app/appels",
      tag: `call-${str(p.id)}`,
      requireInteraction: true,
      lang: locale,
      ttl: 300,
      urgency: "high",
    };
  }
  if (item.kind === "order") {
    const total = typeof p.total === "number" ? formatPrice(p.total, locale) : "";
    return {
      title: t("order", { code: str(p.public_id), total }),
      body: [p.mode === "delivery" ? t("delivery") : t("takeaway"), str(p.customer)].filter(Boolean).join(" · "),
      url: "/app/stats",
      tag: `order-${str(p.id)}`,
      requireInteraction: false,
      lang: locale,
      ttl: 3600,
      urgency: "high",
    };
  }
  if (item.kind === "notification") {
    const kind = str(p.kind);
    if (!(kind in OWNER_NOTIFICATIONS)) return null;
    const n = createTranslator({ locale, messages: MESSAGES[locale], namespace: "notifications" });
    const f = createFormatter({ locale, timeZone: "Africa/Algiers" });
    const data = (p.payload ?? {}) as Record<string, unknown>;
    const iso = str(data.paid_until) || str(data.ends_at);
    const date = iso ? f.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" }) : "";
    return {
      title: restaurantName,
      body: n(`kinds.${kind}` as never, { date, reason: str(data.reason), restaurant: str(data.restaurant) } as never),
      url: OWNER_NOTIFICATIONS[kind],
      tag: `notif-${str(p.id)}`,
      requireInteraction: false,
      lang: locale,
      ttl: 86_400,
      urgency: "normal",
    };
  }
  return null;
}
