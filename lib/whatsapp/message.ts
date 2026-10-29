import type { I18nText, Lang } from "@/lib/menu/types";
import { formatPrice } from "@/lib/price";
import { formatDzPhone } from "@/lib/utils/phone";

/** Priced snapshot returned by public.submit_order(). */
export type PlacedOrder = {
  public_id: string;
  restaurant_name: string;
  whatsapp: string;
  mode: "delivery" | "takeaway";
  items: { name: I18nText; variant: I18nText | null; extras: { name: I18nText; price: number }[]; unit_price: number; qty: number; line_total: number }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  zone_name: string | null;
  eta_label: string | null;
};

export type WhatsAppLabels = {
  newOrder: string;
  mode: string;
  delivery: string;
  takeaway: string;
  address: string;
  zone: string;
  note: string;
  customer: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  cash: string;
  via: string;
};

const t = (v: I18nText | null | undefined, lang: Lang) => v?.[lang] || v?.fr || v?.ar || "";

/**
 * The order as a WhatsApp message (*bold* is WhatsApp markup). Written in the
 * diner's language; numbers stay Western digits.
 */
export function buildOrderMessage(
  order: PlacedOrder,
  customer: { name: string; phone: string; address?: string | null; note?: string | null },
  lang: Lang,
  labels: WhatsAppLabels,
  appName: string,
): string {
  const price = (n: number) => formatPrice(n, lang);
  const lines: string[] = [];
  lines.push(`*${labels.newOrder} #${order.public_id}*`);
  lines.push(order.restaurant_name);
  lines.push("");
  for (const i of order.items) {
    const variant = i.variant ? ` (${t(i.variant, lang)})` : "";
    lines.push(`${i.qty} × ${t(i.name, lang)}${variant} : ${price(i.line_total)}`);
    for (const x of i.extras) lines.push(`   + ${t(x.name, lang)}`);
  }
  lines.push("");
  lines.push(`*${labels.mode} :* ${order.mode === "delivery" ? labels.delivery : labels.takeaway}`);
  if (order.mode === "delivery") {
    if (order.zone_name) lines.push(`*${labels.zone} :* ${order.zone_name}`);
    if (customer.address) lines.push(`*${labels.address} :* ${customer.address}`);
  }
  if (customer.note) lines.push(`*${labels.note} :* ${customer.note}`);
  lines.push("");
  if (order.delivery_fee > 0) {
    lines.push(`${labels.subtotal} : ${price(order.subtotal)}`);
    lines.push(`${labels.deliveryFee} : ${price(order.delivery_fee)}`);
  }
  lines.push(`*${labels.total} : ${price(order.total)}*`);
  lines.push(labels.cash);
  lines.push("");
  lines.push(`*${labels.customer} :* ${customer.name} · ${formatDzPhone(customer.phone)}`);
  lines.push(labels.via.replace("{app}", appName));
  // French typography: no space before ":" in Arabic.
  return lang === "ar" ? lines.join("\n").replace(/ :/g, ":") : lines.join("\n");
}

/** wa.me link with the message prefilled. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
