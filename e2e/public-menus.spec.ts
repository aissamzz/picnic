import { expect, test } from "@playwright/test";
import { db, tempRestaurant } from "./db";

const TEMPLATES = ["pizzeria", "cafe", "traditionnel", "gastro", "patisserie", "grill", "jus", "mer", "coffee"];

for (const template of TEMPLATES) {
  for (const lang of ["fr", "ar"] as const) {
    test(`${template} renders the seeded menu in ${lang}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/apercu/${template}/${lang}/pizzeria-roma-menu?t=T3`);
      await expect(page.locator("html")).toHaveAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/pizzeria roma/i);
      await expect(page.getByText(lang === "ar" ? "بيتزا مارغريتا" : "Pizza Margherita").first()).toBeVisible();
      await expect(page.getByText("Table 3").first()).toBeVisible();
      // Item sheet with sizes and extras.
      await page.getByRole("button", { name: lang === "ar" ? /بيتزا الفصول الأربعة/ : /Pizza 4 Saisons/ }).first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByText(lang === "ar" ? "كبيرة" : "Large")).toBeVisible();
      await expect(sheet.getByText(lang === "ar" ? "1500 دج" : "1 500 DA")).toBeVisible();
      await sheet.getByRole("button", { name: lang === "ar" ? "إغلاق" : "Fermer" }).click();
      await expect(sheet).toBeHidden();
      expect(errors).toEqual([]);
    });
  }
}

test("table link: search, favorites, info sheet, table label", async ({ page }) => {
  await page.goto("/pizzeria-roma-menu?t=T3&lang=fr");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/pizzeria roma/i);
  await expect(page.getByText("Table 3").first()).toBeVisible();

  await page.getByPlaceholder("Rechercher un plat").fill("tacos");
  await expect(page.getByRole("button", { name: /Tacos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pizza Margherita/ })).toHaveCount(0);
  await page.getByPlaceholder("Rechercher un plat").fill("introuvable");
  await expect(page.getByText(/Aucun plat ne correspond/)).toBeVisible();
  await page.getByRole("button", { name: "Effacer la recherche" }).click();

  await page.getByRole("button", { name: /Kalb el louz/ }).click();
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await page.getByRole("button", { name: "Fermer" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Favoris/ }).click();
  await expect(page.getByRole("button", { name: /Kalb el louz/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Pizza Margherita/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Infos" }).click();
  const info = page.getByRole("dialog");
  await expect(info.getByText("Horaires")).toBeVisible();
  await expect(info.getByText("Aujourd'hui")).toBeVisible();
  await expect(info.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/pizzeriaroma.jijel");
});

test("order link visit is logged with its source", async ({ page }) => {
  const client = db();
  const since = new Date().toISOString();
  await page.goto("/cafe-el-bahia?src=ig");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Café El Bahia");
  await expect
    .poll(async () => {
      const { data } = await client
        .from("menu_events")
        .select("kind, source")
        .eq("restaurant_id", "00000000-0000-4000-a000-000000000002")
        .gte("created_at", since);
      return data;
    })
    .toContainEqual({ kind: "view_order", source: "instagram" });
});

test("unknown link: 404 with did-you-mean", async ({ page }) => {
  const res = await page.goto("/pizzeria-rome");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Menu introuvable")).toBeVisible();
  await expect(page.getByRole("link", { name: /Pizzeria Roma/ })).toHaveAttribute("href", "/pizzeria-roma");
});

test("paused menu, expired menu", async ({ page }) => {
  const paused = await tempRestaurant({ status: "paused" });
  const expired = await tempRestaurant({ status: "expired" });
  try {
    await page.goto(`/${paused.slug}?lang=fr`);
    await expect(page.getByText("Menu en pause")).toBeVisible();
    await expect(page.getByText("Thé")).toHaveCount(0);

    await page.goto(`/${expired.slug}?lang=fr`);
    await expect(page.getByText("Thé")).toBeVisible();
    await expect(page.getByRole("link", { name: /Menu propulsé par/ })).toBeVisible();
  } finally {
    await paused.cleanup();
    await expired.cleanup();
  }
});

test("renamed restaurant: old link 301s and keeps the table code", async ({ page, request }) => {
  const r = await tempRestaurant();
  const old = `${r.slug}-old`;
  await db().from("slug_history").insert({ restaurant_id: r.id, old_slug: old });
  try {
    const res = await request.get(`/${old}-menu?t=T1`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toMatch(new RegExp(`/${r.slug}-menu\\?t=T1$`));
    await page.goto(`/${old}-menu?t=T1&lang=fr`);
    await expect(page).toHaveURL(new RegExp(`/${r.slug}-menu\\?t=T1`));
    await expect(page.getByText("Table 1").first()).toBeVisible();
  } finally {
    await r.cleanup();
  }
});

test("owner edits refresh the cached public menu", async ({ page }) => {
  const { signUp, randomPhone, rand } = await import("./helpers");
  await signUp(page, randomPhone());
  const name = `Cache ${rand()}`;
  await page.getByLabel("Nom du restaurant").fill(name);
  await page.getByLabel("Wilaya").selectOption("18");
  await expect(page.getByText("Disponible")).toBeVisible();
  const slug = await page.getByLabel("Votre lien").inputValue();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/onboarding\/2$/);

  // First visit renders and caches the (empty) menu.
  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByText("Le menu arrive bientôt.")).toBeVisible();

  await page.goto("/app/onboarding/3");
  await page.getByRole("button", { name: "Saisir à la main" }).click();
  await page.getByLabel("Nom en français").fill("Boissons");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
  const itemForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Ajouter un plat" }) });
  await itemForm.getByLabel("Nom en français").fill("Citronnade");
  await itemForm.getByLabel("Prix (DA)").fill("180");
  await itemForm.getByRole("button", { name: "Ajouter un plat" }).click();
  await expect(page.getByText("Citronnade")).toBeVisible();

  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByRole("button", { name: /Citronnade/ })).toBeVisible();
});
