import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import { NNBSP } from "@/lib/price";
import { buildOrderMessage, whatsappLink, type PlacedOrder } from "./message";

const order: PlacedOrder = {
  public_id: "K7M2QX",
  restaurant_name: "Pizzeria Roma",
  whatsapp: "+213555000001",
  mode: "delivery",
  items: [
    {
      name: { fr: "Pizza 4 Saisons", ar: "بيتزا الفصول الأربعة" },
      variant: { fr: "Large", ar: "كبيرة" },
      extras: [{ name: { fr: "Supplément fromage", ar: "جبن إضافي" }, price: 100 }],
      unit_price: 1600,
      qty: 2,
      line_total: 3200,
    },
    { name: { fr: "Tacos", ar: "تاكوس" }, variant: null, extras: [], unit_price: 550, qty: 1, line_total: 550 },
  ],
  subtotal: 3750,
  delivery_fee: 250,
  total: 4000,
  zone_name: "Kissir",
  eta_label: "30-45 min",
};
const customer = { name: "Yacine", phone: "+213661000001", address: "Cité 100 logements, bât. B", note: "Sans oignons" };

describe("buildOrderMessage", () => {
  it("writes the French order", () => {
    const m = buildOrderMessage(order, customer, "fr", fr.menu.orderMessage, "Liinky");
    expect(m).toBe(
      [
        "*Nouvelle commande #K7M2QX*",
        "Pizzeria Roma",
        "",
        `2 × Pizza 4 Saisons (Large) : 3${NNBSP}200 DA`,
        "   + Supplément fromage",
        "1 × Tacos : 550 DA",
        "",
        "*Mode :* Livraison",
        "*Zone :* Kissir",
        "*Adresse :* Cité 100 logements, bât. B",
        "*Remarque :* Sans oignons",
        "",
        `Sous-total : 3${NNBSP}750 DA`,
        "Livraison : 250 DA",
        `*Total : 4${NNBSP}000 DA*`,
        "Paiement à la livraison",
        "",
        "*Client :* Yacine · 0661 00 00 01",
        "Envoyé depuis Liinky",
      ].join("\n"),
    );
  });

  it("writes Arabic with Arabic names and Western digits", () => {
    const m = buildOrderMessage({ ...order, mode: "takeaway", delivery_fee: 0, total: 3750 }, { ...customer, note: null }, "ar", ar.menu.orderMessage, "Liinky");
    expect(m).toContain("2 × بيتزا الفصول الأربعة (كبيرة): 3200 دج");
    expect(m).toContain("*الطريقة:* استلام من المحل");
    expect(m).toContain("*المجموع: 3750 دج*");
    expect(m).not.toContain("العنوان"); // takeaway: no address
    expect(m).not.toContain("التوصيل:"); // no fee line
  });
});

describe("whatsappLink", () => {
  it("encodes the text for wa.me", () => {
    expect(whatsappLink("+213555000001", "Bonjour & merci\n2 × Tacos")).toBe(
      "https://wa.me/213555000001?text=Bonjour%20%26%20merci%0A2%20%C3%97%20Tacos",
    );
  });
});
