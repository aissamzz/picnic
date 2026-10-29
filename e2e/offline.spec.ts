import { expect, test, type Page } from "@playwright/test";
import { db } from "./db";
import { rand, randomPhone, signUp } from "./helpers";

/** Owner with one category and one dish; returns the slug. */
async function ownerWithDish(page: Page, dish: string): Promise<string> {
  await signUp(page, randomPhone());
  await page.getByLabel("Nom du restaurant").fill(`Hors ligne ${rand()}`);
  await page.getByLabel("Wilaya").selectOption("16");
  await expect(page.getByText("Disponible")).toBeVisible();
  const slug = await page.getByLabel("Votre lien").inputValue();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/onboarding\/2$/);
  await page.goto("/app/menu");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).first().click();
  await page.getByLabel("Nom en français").fill("Plats");
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter une catégorie" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Plats" })).toBeVisible();
  await page.getByRole("link", { name: "Ajouter un plat" }).click();
  await page.getByLabel("Nom · En français").fill(dish);
  await page.getByLabel("Prix (DA)", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("switch", { name: `Disponible : ${dish}` })).toBeVisible();
  return slug;
}

test("owner edits made offline are queued and synced on reconnect", async ({ page, context }) => {
  await ownerWithDish(page, "Couscous");
  const categoryUrl = page.url();

  await context.setOffline(true);
  await page.getByRole("switch", { name: "Disponible : Couscous" }).click();
  await expect(page.getByText("Hors ligne : modification enregistrée", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("1 modification en attente du réseau")).toBeVisible();
  const { data: still } = await db().from("items").select("is_sold_out").eq("name->>fr", "Couscous").order("created_at", { ascending: false }).limit(1).single();
  expect(still!.is_sold_out).toBe(false);

  await context.setOffline(false);
  await expect(page.getByText("1 modification envoyée")).toBeVisible();
  await expect(page.getByText("1 modification en attente du réseau")).toHaveCount(0);
  const { data: synced } = await db().from("items").select("is_sold_out").eq("name->>fr", "Couscous").order("created_at", { ascending: false }).limit(1).single();
  expect(synced!.is_sold_out).toBe(true);

  // Prices too, batched with the latest value.
  await page.goto("/app/menu/prix");
  await context.setOffline(true);
  await page.getByLabel("Prix de Couscous").fill("650");
  await page.getByRole("button", { name: "Enregistrer les prix" }).click();
  await expect(page.getByText("1 modification en attente du réseau")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("1 modification envoyée")).toBeVisible();
  const { data: priced } = await db().from("items").select("base_price").eq("name->>fr", "Couscous").order("created_at", { ascending: false }).limit(1).single();
  expect(priced!.base_price).toBe(650);
  expect(categoryUrl).toContain("/app/menu/categories/");
});

// The service worker only ships in production builds: run with E2E_SW=1 against `pnpm build && pnpm start`.
test("diner menu opens offline from the service worker cache", async ({ page, context }) => {
  test.skip(!process.env.E2E_SW, "needs a production build (E2E_SW=1)");
  const slug = await ownerWithDish(page, "Chakhchoukha");
  await page.goto(`/${slug}?lang=fr`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // First visit installs the worker; the next navigation goes through it and is cached.
  await page.reload();
  await expect(page.getByRole("button", { name: /Chakhchoukha/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: /Chakhchoukha/ })).toBeVisible();
  await expect(page.getByText(/Hors connexion : menu enregistré/)).toBeVisible();

  // A page never opened before falls back to the offline screen.
  await page.goto("/tarifs");
  await expect(page.getByRole("heading", { name: "Pas de connexion" })).toBeVisible();
  await context.setOffline(false);
});
