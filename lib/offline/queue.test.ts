import { describe, expect, it } from "vitest";
import { countOps, mergeOp, type QueuedOp } from "./queue";

describe("offline queue merge", () => {
  it("keeps only the last sold-out toggle per item", () => {
    let ops: QueuedOp[] = [];
    ops = mergeOp(ops, { kind: "soldOut", itemId: "a", value: true });
    ops = mergeOp(ops, { kind: "soldOut", itemId: "b", value: true });
    ops = mergeOp(ops, { kind: "soldOut", itemId: "a", value: false });
    expect(ops).toEqual([
      { kind: "soldOut", itemId: "b", value: true },
      { kind: "soldOut", itemId: "a", value: false },
    ]);
    expect(countOps(ops)).toBe(2);
  });

  it("merges price edits into one batch, later rows win", () => {
    let ops: QueuedOp[] = [];
    ops = mergeOp(ops, { kind: "prices", rows: [{ itemId: "a", basePrice: 100, variants: [] }, { itemId: "b", basePrice: 200, variants: [] }] });
    ops = mergeOp(ops, { kind: "soldOut", itemId: "c", value: true });
    ops = mergeOp(ops, { kind: "prices", rows: [{ itemId: "a", basePrice: 150, variants: [] }] });
    expect(ops).toHaveLength(2);
    const prices = ops.find((o) => o.kind === "prices");
    expect(prices).toEqual({ kind: "prices", rows: [{ itemId: "b", basePrice: 200, variants: [] }, { itemId: "a", basePrice: 150, variants: [] }] });
    expect(countOps(ops)).toBe(3);
  });
});
