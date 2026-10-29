import { expect, test, type Page } from "@playwright/test";
import { db, tempRestaurant } from "./db";
import { createRestaurant, rand, randomPhone, signUp } from "./helpers";

const ORDERING = {
  orders_enabled: true,
  whatsapp_order_phone: "+213555123456",
  delivery_enabled: true,
  takeaway_enabled: true,
};

/** Adds "Pizza" with two sizes and one extra to a restaurant's first category. */
async function addPizza(restaurantId: string) {
  const client = db();
  const { data: c } = await client.from("categories").select("id").eq("restaurant_id", restaurantId).limit(1).single();
  const { data: item } = await client
    .from("items")
    .insert({ restaurant_id: restaurantId, category_id: c!.id, name: { fr: "Pizza Roma", ar: "بيتزا روما" }, base_price: 800 })
    .select("id")
    .single();
  await client.from("item_variants").insert([
    { restaurant_id: restaurantId, item_id: item!.id, name: { fr: "Moyenne" }, price: 800, position: 1 },
    { restaurant_id: restaurantId, item_id: item!.id, name: { fr: "Large" }, price: 1200, position: 2 },
  ]);
  await client.from("item_extras").insert({ restaurant_id: restaurantId, item_id: item!.id, name: { fr: "Fromage" }, price: 100 });
}

/** Catches the wa.me redirect and returns the decoded message. */
async function catchWhatsApp(page: Page) {
  let url = "";
  await page.route("https://wa.me/**", (route) => {
    url = route.request().url();
    return route.fulfill({ contentType: "text/html", body: "<p>wa</p>" });
  });
  return () => {
    const u = new URL(url);
    return { number: u.pathname.slice(1), text: u.searchParams.get("text") ?? "" };
  };
}

async function fillCustomer(page: Page, phone: string) {
  await page.getByLabel("Votre nom").fill("Karim");
  await page.getByLabel("Votre téléphone").fill(phone);
}

test("diner orders with size and extra, delivery zone, WhatsApp message", async ({ page }) => {
  const r = await tempRestaurant({ ...ORDERING, min_order: 0, eta_label: "30-45 min" });
  try {
    await addPizza(r.id);
    await db().from("delivery_zones").insert({ restaurant_id: r.id, name: "Centre-ville", fee: 150, position: 1 });
    const wa = await catchWhatsApp(page);

    await page.goto(`/${r.slug}?lang=fr`);
    await page.getByRole("button", { name: /Pizza Roma/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /^Ajouter · / }).click();
    await expect(sheet.getByText("Choisissez un format.")).toBeVisible();
    await sheet.getByRole("radio", { name: /Large/ }).check();
    await sheet.getByRole("checkbox", { name: /Fromage/ }).check();
    await sheet.getByRole("button", { name: "Plus" }).click();
    const add = sheet.getByRole("button", { name: /^Ajouter · / });
    await expect(add).toContainText(/2\D{1,3}600\sDA/);
    await add.click();

    await page.getByRole("button", { name: /Voir le panier/ }).click();
    await page.getByRole("button", { name: "Commander" }).click();
    await page.getByRole("radio", { name: "Livraison" }).check();
    await fillCustomer(page, "0661 00 00 01");
    await page.getByRole("button", { name: "Envoyer sur WhatsApp" }).click();
    await expect(page.getByText("Indiquez votre adresse.")).toBeVisible();
    await page.getByLabel("Adresse de livraison").fill("Rue Didouche, n° 5");
    await page.getByRole("button", { name: "Envoyer sur WhatsApp" }).click();
    await expect(page.getByText("Choisissez votre zone de livraison.")).toBeVisible();
    await expect(page.getByLabel("Zone de livraison").locator("option").nth(1)).toContainText("Centre-ville");
    await page.getByLabel("Zone de livraison").selectOption({ index: 1 });
    await expect(page.getByText(/^2\D{1,3}750\sDA$/)).toBeVisible();
    await page.getByRole("button", { name: "Envoyer sur WhatsApp" }).click();

    await expect.poll(() => page.url()).toContain("wa.me");
    const { number, text } = wa();
    expect(number).toBe("213555123456");
    expect(text).toMatch(/2 × Pizza Roma \(Large\) : 2\s600\sDA/);
    expect(text).toContain("+ Fromage");
    expect(text).toMatch(/\*Total : 2\s750\sDA\*/);
    expect(text).toContain("0661 00 00 01");

    const { data: orders } = await db().from("orders").select("subtotal, delivery_fee, mode, customer_phone").eq("restaurant_id", r.id);
    expect(orders).toEqual([{ subtotal: 2600, delivery_fee: 150, mode: "delivery", customer_phone: "+213661000001" }]);
  } finally {
    await r.cleanup();
  }
});

test("minimum order and blocked phone are enforced", async ({ page }) => {
  const r = await tempRestaurant({ ...ORDERING, delivery_enabled: false, min_order: 250 });
  const blocked = `+2136${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  await db().from("blocked_phones").insert({ phone: blocked, reports: 3, blocked_at: new Date().toISOString() });
  try {
    await page.goto(`/${r.slug}?lang=fr`);
    await page.getByRole("button", { name: /Thé/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: /^Ajouter · / }).click();
    await page.getByRole("button", { name: /Voir le panier/ }).click();
    await expect(page.getByText("Encore 150 DA pour commander.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Commander" })).toBeDisabled();
    await page.getByRole("button", { name: "Plus" }).click();
    await page.getByRole("button", { name: "Plus" }).click();
    await page.getByRole("button", { name: "Commander" }).click();
    await fillCustomer(page, `0${blocked.slice(4)}`);
    await page.getByRole("button", { name: "Envoyer sur WhatsApp" }).click();
    await expect(page.getByText("Ce numéro ne peut pas passer commande.")).toBeVisible();
    const { count } = await db().from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id);
    expect(count).toBe(0);
  } finally {
    await db().from("blocked_phones").delete().eq("phone", blocked);
    await r.cleanup();
  }
});

test("table call reaches the owner's calls screen; owner handles it", async ({ page, browser }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Appels ${rand()}`);
  const { data: r } = await db().from("restaurants").select("id, slug").order("created_at", { ascending: false }).limit(1).single();
  await db().from("tables").insert({ restaurant_id: r!.id, code: "T7", label: "Terrasse 7" });
  const { data: c } = await db().from("categories").insert({ restaurant_id: r!.id, name: { fr: "Plats" } }).select("id").single();
  await db().from("items").insert({ restaurant_id: r!.id, category_id: c!.id, name: { fr: "Chorba" }, base_price: 300 });

  const diner = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await diner.goto(`/${r!.slug}-menu?t=t7&lang=fr`);
  await diner.getByRole("button", { name: "Appeler" }).click();
  await diner.getByRole("button", { name: "Demander l'addition" }).click();
  await expect(diner.getByText("C'est noté, quelqu'un arrive.")).toBeVisible();
  await expect(diner.getByRole("button", { name: /Demander l'addition/ })).toContainText("Déjà demandé");

  // The header chip shows it from any owner screen (polling, no realtime locally).
  await page.goto("/app");
  await page.getByRole("link", { name: "1 appel" }).click();
  await expect(page).toHaveURL(/\/app\/appels$/);
  await expect(page.getByText("Terrasse 7")).toBeVisible();
  await expect(page.getByText(/Demande l'addition/)).toBeVisible();
  await page.getByRole("button", { name: "J'y vais · Terrasse 7" }).click();
  await expect(page.getByRole("heading", { name: "Traités aujourd'hui" })).toBeVisible();
  await expect(page.getByText("Aucun appel en attente.")).toBeVisible();
  const { data: calls } = await db().from("waiter_calls").select("kind, status").eq("restaurant_id", r!.id);
  expect(calls).toEqual([{ kind: "bill", status: "handled" }]);
});

test("order settings enable ordering; stats log flags a fake order", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Commandes ${rand()}`);
  const { data: r } = await db().from("restaurants").select("id, slug").order("created_at", { ascending: false }).limit(1).single();
  const { data: c } = await db().from("categories").insert({ restaurant_id: r!.id, name: { fr: "Plats" } }).select("id").single();
  await db().from("items").insert({ restaurant_id: r!.id, category_id: c!.id, name: { fr: "Couscous" }, base_price: 700 });

  await page.goto("/app/reglages/commandes");
  // Onboarding pre-fills the owner's number; start from an empty one.
  await page.getByLabel("Numéro WhatsApp des commandes").fill("");
  await expect(page.getByRole("switch", { name: "Accepter les commandes en ligne" })).toBeChecked();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Indiquez un numéro WhatsApp pour accepter les commandes.")).toBeVisible();
  await page.getByLabel("Numéro WhatsApp des commandes").fill("0555 44 33 22");
  await page.getByRole("switch", { name: "Livraison" }).click();
  await page.getByRole("button", { name: "Ajouter une zone" }).click();
  await page.getByLabel("Zone").first().fill("Bab Ezzouar");
  await page.getByLabel("Frais (DA)").first().fill("200");
  await page.getByLabel("Commande minimum (DA)").fill("500");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Réglages des commandes enregistrés")).toBeVisible();
  const { data: saved } = await db().from("restaurants").select("orders_enabled, whatsapp_order_phone, min_order").eq("id", r!.id).single();
  expect(saved).toEqual({ orders_enabled: true, whatsapp_order_phone: "+213555443322", min_order: 500 });

  // Public order link now shows the cart controls.
  await page.goto(`/${r!.slug}?lang=fr`);
  await page.getByRole("button", { name: /Couscous/ }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /^Ajouter · 700 DA/ })).toBeVisible();

  // A fake order: flag it, the phone collects a report.
  const phone = `+2137${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  await db().from("orders").insert({
    restaurant_id: r!.id,
    public_id: "FAKE01",
    mode: "takeaway",
    customer_name: "Farceur",
    customer_phone: phone,
    items: [{ name: "Couscous", qty: 10 }],
    subtotal: 7000,
  });
  await page.goto("/app/stats");
  await expect(page.getByText("Commandes envoyées")).toBeVisible();
  await page.getByRole("button", { name: "Signaler comme fausse #FAKE01" }).click();
  await expect(page.getByText("Fausse commande")).toBeVisible();
  const { data: report } = await db().from("blocked_phones").select("reports").eq("phone", phone).single();
  expect(report?.reports).toBe(1);
  await page.getByRole("button", { name: "Annuler le signalement #FAKE01" }).click();
  await expect(page.getByText("Fausse commande")).toHaveCount(0);
  await db().from("blocked_phones").delete().eq("phone", phone);
});
