import { describe, expect, it } from "vitest";
import { itemSchema } from "./menu";

const base = { categoryId: "00000000-0000-4000-b001-000000000001", name: { fr: "Pizza" }, description: {} };

describe("itemSchema", () => {
  it("parses sizes and free extras", () => {
    const v = itemSchema.parse({
      ...base,
      basePrice: "",
      variants: [{ name: { fr: "M" }, price: "1.100" }],
      extras: [{ name: { ar: "زيتون" }, price: "" }],
    });
    expect(v.basePrice).toBeNull();
    expect(v.variants[0]).toEqual({ name: { fr: "M" }, price: 1100 });
    expect(v.extras[0]).toEqual({ name: { ar: "زيتون" }, price: 0 });
  });
  it("rejects a size without price or name", () => {
    expect(itemSchema.safeParse({ ...base, variants: [{ name: { fr: "M" }, price: "" }] }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, variants: [{ name: {}, price: 100 }] }).success).toBe(false);
  });
  it("caps photos at 4", () => {
    expect(itemSchema.safeParse({ ...base, photos: ["a", "b", "c", "d", "e"] }).success).toBe(false);
  });
});
