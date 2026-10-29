"use client";

import { useSyncExternalStore } from "react";
import type { CartLine } from "@/lib/menu/cart";

// One cart per restaurant, shared by the item sheet and the cart layer, kept
// in localStorage so it survives reloads and WhatsApp round trips.
const listeners = new Set<() => void>();
const carts = new Map<string, CartLine[]>();
const EMPTY: CartLine[] = [];

const key = (rid: string) => `liinky:cart:${rid}`;

function read(rid: string): CartLine[] {
  if (!carts.has(rid)) {
    try {
      carts.set(rid, JSON.parse(localStorage.getItem(key(rid)) ?? "[]"));
    } catch {
      carts.set(rid, []);
    }
  }
  return carts.get(rid)!;
}

export function setCart(rid: string, next: CartLine[]) {
  carts.set(rid, next);
  try {
    localStorage.setItem(key(rid), JSON.stringify(next));
  } catch {
    /* private mode: cart lives for this page only */
  }
  listeners.forEach((l) => l());
}

export function useCart(rid: string): [CartLine[], (next: CartLine[]) => void] {
  const cart = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(rid),
    () => EMPTY,
  );
  return [cart, (next) => setCart(rid, next)];
}
