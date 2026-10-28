import { describe, expect, it } from "vitest";
import { infoSchema, itemInputSchema } from "./onboarding";

describe("infoSchema", () => {
  const base = { name: "Pizzeria Roma", slug: "pizzeria-roma", type: "pizzeria", wilayaCode: "18", whatsapp: "0555 12 34 56" };
  it("parses and normalizes", () => {
    expect(infoSchema.parse(base)).toMatchObject({ wilayaCode: 18, whatsapp: "+213555123456", commune: "" });
  });
  it("allows no WhatsApp", () => expect(infoSchema.parse({ ...base, whatsapp: "" }).whatsapp).toBeNull());
  it("rejects table-style slugs", () => expect(infoSchema.safeParse({ ...base, slug: "roma-menu" }).success).toBe(false));
});

describe("itemInputSchema", () => {
  const id = "00000000-0000-4000-c001-000000000001";
  it("accepts an Arabic-only name and messy prices", () => {
    expect(itemInputSchema.parse({ categoryId: id, name: { ar: "شاورما" }, price: "1.100" })).toEqual({
      categoryId: id,
      name: { ar: "شاورما" },
      price: 1100,
    });
  });
  it("needs a name in at least one language", () => {
    expect(itemInputSchema.safeParse({ categoryId: id, name: { fr: " ", ar: "" } }).success).toBe(false);
  });
});
