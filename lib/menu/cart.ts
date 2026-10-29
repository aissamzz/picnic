import type { MenuItem } from "./types";

/** A cart line. Prices are recomputed by the server; these are for display. */
export type CartLine = { key: string; itemId: string; variantId: string | null; extraIds: string[]; qty: number };

export function lineKey(itemId: string, variantId: string | null, extraIds: string[]): string {
  return [itemId, variantId ?? "-", [...extraIds].sort().join(",")].join("|");
}

/** Adds a line, merging with an identical one. */
export function addLine(cart: CartLine[], itemId: string, variantId: string | null, extraIds: string[], qty: number): CartLine[] {
  const key = lineKey(itemId, variantId, extraIds);
  const existing = cart.find((l) => l.key === key);
  if (existing) return cart.map((l) => (l.key === key ? { ...l, qty: Math.min(50, l.qty + qty) } : l));
  return [...cart, { key, itemId, variantId, extraIds: [...extraIds].sort(), qty: Math.min(50, qty) }];
}

export function setQty(cart: CartLine[], key: string, qty: number): CartLine[] {
  return qty <= 0 ? cart.filter((l) => l.key !== key) : cart.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l));
}

/** Unit price of a configuration, or null when the item/options no longer exist. */
export function unitPrice(item: MenuItem | undefined, variantId: string | null, extraIds: string[]): number | null {
  if (!item) return null;
  let base: number | null;
  if (variantId) base = item.variants.find((v) => v.id === variantId)?.price ?? null;
  else base = item.variants.length ? null : item.base_price;
  if (base == null) return null;
  let extras = 0;
  for (const id of extraIds) {
    const x = item.extras.find((e) => e.id === id);
    if (!x) return null;
    extras += x.price;
  }
  return base + extras;
}

/** Drops lines that can't be ordered anymore (removed, sold out, changed options). */
export function validLines(cart: CartLine[], items: Map<string, MenuItem>): CartLine[] {
  return cart.filter((l) => {
    const item = items.get(l.itemId);
    return item && !item.is_sold_out && unitPrice(item, l.variantId, l.extraIds) != null;
  });
}

export function subtotal(cart: CartLine[], items: Map<string, MenuItem>): number {
  return cart.reduce((sum, l) => sum + (unitPrice(items.get(l.itemId), l.variantId, l.extraIds) ?? 0) * l.qty, 0);
}

export function count(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}
