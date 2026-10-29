import { expect, test, type Page } from "@playwright/test";
import { rand, randomPhone, signUp } from "./helpers";

async function ownerWithDishes(page: Page): Promise<string> {
  await signUp(page, randomPhone());
  await page.getByLabel("Nom du restaurant").fill(`Combos ${rand()}`);
  await page.getByLabel("Wilaya").selectOption("16");
  await expect(page.getByText("Disponible")).toBeVisible();
  const slug = await page.getByLabel("Votre lien").inputValue();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/onboarding\/2$/);
  await page.goto("/app/menu");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).first().click();
  await page.getByLabel("Nom en français").fill("Burgers");
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter une catégorie" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Burgers" })).toBeVisible();
  for (const [name, price] of [["Burger maison", "650"], ["Frites", "200"]]) {
    await page.getByRole("link", { name: "Ajouter un plat" }).click();
    await page.getByLabel("Nom · En français").fill(name);
    await page.getByLabel("Prix (DA)", { exact: true }).fill(price);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  return slug;
}

test("marketing pages and demo menus", async ({ page }) => {
  await page.goto("/?lang=fr");
  await expect(page.getByRole("heading", { level: 1, name: "Votre menu papier en menu QR, en 5 minutes." })).toBeVisible();
  await expect(page.getByRole("img", { name: "Liinky" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Tarifs" }).first().click();
  await expect(page.getByText(/24\s000\sDA/).first()).toBeVisible();
  await page.goto("/demo");
  await page.getByRole("link", { name: "Ouvrir le menu Traditionnel" }).click();
  await expect(page).toHaveURL(/\/template-3$/);
  await expect(page.getByRole("heading", { name: "Meilleures ventes" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Couscous aux légumes/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Combos" })).toBeVisible();
  for (const path of ["/aide", "/conditions", "/confidentialite"]) expect((await page.goto(path))!.status()).toBe(200);
});

test("owner stars best sellers and builds a combo; the menu shows both", async ({ page }) => {
  const slug = await ownerWithDishes(page);

  await page.goto("/app/menu/meilleures-ventes");
  await page.getByRole("button", { name: /Burger maison/ }).click();
  await expect(page.getByText("1 plat en avant")).toBeVisible();

  await page.goto("/app/menu/combos");
  await page.getByRole("button", { name: "Ajouter un combo" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nom en français").fill("Menu Midi");
  await sheet.getByLabel("Prix du combo (DA)").fill("800");
  await sheet.getByRole("checkbox", { name: "Burger maison" }).check();
  await sheet.getByRole("checkbox", { name: "Frites" }).check();
  await sheet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Combo enregistré.")).toBeVisible();
  await expect(page.getByText("Burger maison + Frites")).toBeVisible();

  await page.waitForTimeout(500);
  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByRole("heading", { name: "Meilleures ventes" })).toBeVisible();
  await page.getByRole("button", { name: /Menu Midi/ }).click();
  await expect(page.getByRole("dialog").getByText("Contient : Burger maison + Frites")).toBeVisible();
});
