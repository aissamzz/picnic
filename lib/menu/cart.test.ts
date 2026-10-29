import { describe, expect, it } from "vitest";
import { addLine, count, setQty, subtotal, unitPrice, validLines } from "./cart";
import type { MenuItem } from "./types";

const pizza: MenuItem = {
  id: "p",
  name: { fr: "Pizza" },
  description: {},
  base_price: 1100,
  photos: [],
  tags: [],
  is_sold_out: false,
  variants: [
    { id: "m", name: { fr: "M" }, price: 1100 },
    { id: "l", name: { fr: "L" }, price: 1500 },
  ],
  extras: [{ id: "x", name: { fr: "Fromage" }, price: 100 }],
};
const tea: MenuItem = { ...pizza, id: "t", base_price: 100, variants: [], extras: [], is_sold_out: false };
const items = new Map([
  ["p", pizza],
  ["t", tea],
]);

describe("cart", () => {
  it("merges identical lines and keeps different options apart", () => {
    let c = addLine([], "p", "l", ["x"], 1);
    c = addLine(c, "p", "l", ["x"], 2);
    c = addLine(c, "p", "m", [], 1);
    expect(c).toHaveLength(2);
    expect(count(c)).toBe(4);
    expect(subtotal(c, items)).toBe(1600 * 3 + 1100);
  });
  it("requires a size when the item has sizes", () => {
    expect(unitPrice(pizza, null, [])).toBeNull();
    expect(unitPrice(tea, null, [])).toBe(100);
  });
  it("removes lines at zero and drops unavailable ones", () => {
    let c = addLine(addLine([], "t", null, [], 1), "p", "l", [], 1);
    c = setQty(c, c[0].key, 0);
    expect(c.map((l) => l.itemId)).toEqual(["p"]);
    expect(validLines(c, new Map([["p", { ...pizza, is_sold_out: true }]]))).toEqual([]);
    expect(validLines(addLine([], "p", "gone", [], 1), items)).toEqual([]);
  });
});
