/**
 * Owner offline queue: sold-out toggles and price edits made without network
 * are kept in localStorage (per restaurant) and replayed on reconnect.
 * Later edits to the same item replace earlier ones.
 */
export type PriceRow = { itemId: string; basePrice: number | null; variants: { id: string; price: number }[] };
export type QueuedOp = { kind: "soldOut"; itemId: string; value: boolean } | { kind: "prices"; rows: PriceRow[] };

const KEY = "liinky:offline-queue:v1";
export const QUEUE_EVENT = "liinky:offline-queue";

type Stored = { restaurantId: string; ops: QueuedOp[] };
let scope: string | null = null;

/** Set by the owner shell so queued ops never replay against another restaurant. */
export function setQueueScope(restaurantId: string) {
  scope = restaurantId;
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(s: Stored | null) {
  try {
    if (!s || s.ops.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: nothing we can keep.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Pure merge, exported for tests. */
export function mergeOp(ops: QueuedOp[], op: QueuedOp): QueuedOp[] {
  if (op.kind === "soldOut") return [...ops.filter((o) => !(o.kind === "soldOut" && o.itemId === op.itemId)), op];
  const prev = ops.find((o): o is Extract<QueuedOp, { kind: "prices" }> => o.kind === "prices");
  const ids = new Set(op.rows.map((r) => r.itemId));
  const rows = [...(prev?.rows.filter((r) => !ids.has(r.itemId)) ?? []), ...op.rows];
  return [...ops.filter((o) => o.kind !== "prices"), { kind: "prices", rows }];
}

/** Number of pending changes (items touched). */
export function countOps(ops: QueuedOp[]) {
  return ops.reduce((n, o) => n + (o.kind === "prices" ? o.rows.length : 1), 0);
}

export function pendingOps(): QueuedOp[] {
  const s = read();
  return s && s.restaurantId === scope ? s.ops : [];
}

export function enqueue(op: QueuedOp) {
  if (!scope) return;
  const s = read();
  const ops = s && s.restaurantId === scope ? s.ops : [];
  write({ restaurantId: scope, ops: mergeOp(ops, op) });
}

export function replaceQueue(ops: QueuedOp[]) {
  if (scope) write({ restaurantId: scope, ops });
}

export function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** A server action that never reached the server (network down) rejects with a TypeError. */
export function isNetworkError(e: unknown) {
  return isOffline() || e instanceof TypeError;
}
