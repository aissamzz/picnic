import { describe, expect, it } from "vitest";
import { countItems, findDuplicates, mergeItems, nameKey, toApplyPayload, toDraft } from "./draft";
import type { Extraction } from "./schema";

const sure = { name: 0.95, price: 0.95 };
const item = (fr: string | null, price_text: string | null, extra: Partial<Extraction["categories"][0]["items"][0]> = {}) => ({
  name: { fr, ar: null },
  description: null,
  price_text,
  variants: [],
  confidence: sure,
  ...extra,
});

describe("toDraft", () => {
  it("parses messy printed prices", () => {
    const d = toDraft({
      problem: "none",
      categories: [{ name: { fr: "Plats", ar: null }, items: [item("A", "1.100"), item("B", "1100 DA"), item("C", "11 00"), item("D", "١٢٠٠ دج"), item("E", "800da")] }],
    });
    expect(d.categories[0].items.map((i) => i.price)).toEqual([1100, 1100, 1100, 1200, 800]);
    expect(d.categories[0].items.every((i) => !i.check.price)).toBe(true);
  });

  it("flags low confidence, unreadable and missing prices", () => {
    const d = toDraft({
      problem: "partial",
      categories: [
        {
          name: { fr: null, ar: "أكل" },
          items: [
            item("Low name", "100", { confidence: { name: 0.4, price: 0.9 } }),
            item("Low price", "100", { confidence: { name: 0.9, price: 0.5 } }),
            item("Garbled", "abc"),
            item("No price", null),
          ],
        },
      ],
    });
    expect(d.partial).toBe(true);
    expect(d.categories[0].items.map((i) => i.check)).toEqual([
      { name: true, price: false },
      { name: false, price: true },
      { name: false, price: true },
      { name: false, price: true },
    ]);
  });

  it("keeps sizes and ignores the single price when there are sizes", () => {
    const d = toDraft({
      problem: "none",
      categories: [
        {
          name: { fr: "Pizzas", ar: null },
          items: [
            item("4 Saisons", "1100", {
              variants: [
                { name: { fr: "Moyenne", ar: null }, price_text: "1.100" },
                { name: { fr: "Large", ar: null }, price_text: "15 00" },
              ],
            }),
          ],
        },
      ],
    });
    const i = d.categories[0].items[0];
    expect(i.price).toBeNull();
    expect(i.variants.map((v) => v.price)).toEqual([1100, 1500]);
    expect(toApplyPayload(d).categories[0].items[0].price).toBeNull();
  });

  it("folds sections repeated across photos and drops nameless dishes", () => {
    const d = toDraft({
      problem: "none",
      categories: [
        { name: { fr: "Boissons", ar: null }, items: [item("Thé", "100")] },
        { name: { fr: "BOISSONS ", ar: "مشروبات" }, items: [item("Café", "150"), item(null, "50")] },
        { name: { fr: "Vide", ar: null }, items: [] },
      ],
    });
    expect(d.categories).toHaveLength(1);
    expect(d.categories[0].name).toEqual({ fr: "Boissons", ar: "مشروبات" });
    expect(countItems(d)).toBe(2);
  });
});

describe("duplicates", () => {
  it("matches names regardless of accents, case and Arabic letter variants", () => {
    expect(nameKey({ fr: "Café  Crème", ar: "" })).toBe(nameKey({ fr: "cafe creme", ar: "" }));
    expect(nameKey({ fr: "", ar: "قهوة" })).toBe(nameKey({ fr: "", ar: "قهوه" }));
    expect(nameKey({ fr: "", ar: "إسبريسو" })).toBe(nameKey({ fr: "", ar: "اسبريسو" }));
  });

  it("finds and merges a duplicate, keeping the best of both", () => {
    const d = toDraft({
      problem: "none",
      categories: [
        { name: { fr: "Boissons", ar: null }, items: [item("Café", null), item("Thé", "100")] },
        { name: { fr: "Chaud", ar: null }, items: [{ ...item("cafe", "150"), name: { fr: "cafe", ar: "قهوة" } }] },
      ],
    });
    const dupes = findDuplicates(d);
    expect(dupes.size).toBe(1);
    const [[dup, keep]] = [...dupes];
    const merged = mergeItems(d, keep, dup);
    expect(merged.categories).toHaveLength(1); // "Chaud" became empty
    const cafe = merged.categories[0].items[0];
    expect(cafe).toMatchObject({ name: { fr: "Café", ar: "قهوة" }, price: 150, check: { price: false } });
    expect(findDuplicates(merged).size).toBe(0);
  });
});
