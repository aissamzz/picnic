import { describe, expect, it } from "vitest";
import { isWellFormedSlug, parseMenuSegment, slugCandidates, slugify } from ".";

describe("slugify", () => {
  it.each([
    ["Café El Bahia", "cafe-el-bahia"],
    ["Pizzeria Roma", "pizzeria-roma"],
    ["L'Étoile d'Or", "letoile-dor"],
    ["  Grill & Co!! ", "grill-co"],
    ["Snack Le Menu", "snack-le"],
    ["مطعم الأمير", ""],
  ])("%s -> %s", (input, out) => expect(slugify(input)).toBe(out));
});

describe("isWellFormedSlug", () => {
  it.each(["pizzeria-roma", "abc", "cafe-2"])("accepts %s", (s) => expect(isWellFormedSlug(s)).toBe(true));
  it.each(["ab", "-abc", "abc-", "a--b", "Abc", "roma-menu", "a".repeat(41)])("rejects %s", (s) =>
    expect(isWellFormedSlug(s)).toBe(false),
  );
});

describe("slugCandidates", () => {
  it("suggests name, name-commune then numbers", () => {
    expect(slugCandidates("Pizzeria Roma", "Jijel").slice(0, 3)).toEqual(["pizzeria-roma", "pizzeria-roma-jijel", "pizzeria-roma-2"]);
  });
  it("falls back for Arabic-only names", () => {
    expect(slugCandidates("مطعم الأمير", "Béjaïa")[0]).toBe("restaurant-bejaia");
    expect(slugCandidates("مطعم الأمير")[0]).toBe("restaurant");
  });
});

describe("parseMenuSegment", () => {
  it("detects table mode", () => {
    expect(parseMenuSegment("pizzeria-roma-menu")).toEqual({ slug: "pizzeria-roma", mode: "table" });
    expect(parseMenuSegment("pizzeria-roma")).toEqual({ slug: "pizzeria-roma", mode: "order" });
  });
});
