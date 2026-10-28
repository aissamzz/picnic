import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { rand, randomPhone, signUp } from "./helpers";

/** Fresh owner with a restaurant (onboarding step 1 done). Returns the slug. */
async function owner(page: Page): Promise<string> {
  await signUp(page, randomPhone());
  await page.getByLabel("Nom du restaurant").fill(`Gestion ${rand()}`);
  await page.getByLabel("Wilaya").selectOption("16");
  await expect(page.getByText("Disponible")).toBeVisible();
  const slug = await page.getByLabel("Votre lien").inputValue();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/onboarding\/2$/);
  return slug;
}

async function addCategory(page: Page, fr: string, ar = "") {
  await page.goto("/app/menu");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).first().click();
  await page.getByLabel("Nom en français").fill(fr);
  if (ar) await page.getByLabel("Nom en arabe").fill(ar);
  await page.getByRole("dialog").getByRole("button", { name: "Ajouter une catégorie" }).click();
  await expect(page.getByRole("heading", { level: 1, name: fr })).toBeVisible();
}

async function addItem(page: Page, fr: string, price: string) {
  await page.getByRole("link", { name: "Ajouter un plat" }).click();
  await page.getByLabel("Nom · En français").fill(fr);
  await page.getByLabel("Prix (DA)", { exact: true }).fill(price);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("link", { name: new RegExp(fr) })).toBeVisible();
}

test("categories and items: editor with sizes, extras, badge, photo; sold out with undo", async ({ page }) => {
  const slug = await owner(page);
  await addCategory(page, "Pizzas", "بيتزا");

  await page.getByRole("link", { name: "Ajouter un plat" }).click();
  await page.getByLabel("Nom · En français").fill("Pizza Thon");
  await page.getByLabel("Nom · En arabe").fill("بيتزا تونة");
  await page.getByLabel("Description · En français").fill("Thon, oignons, olives.");
  await page.getByRole("button", { name: "Ajouter un format" }).click();
  await page.getByRole("button", { name: "Ajouter un format" }).click();
  await page.locator("#variants-0-fr").fill("Moyenne");
  await page.locator("#variants-0-price").fill("900");
  await page.locator("#variants-1-fr").fill("Large");
  await page.locator("#variants-1-price").fill("1.300");
  await page.getByRole("button", { name: "Ajouter un supplément" }).click();
  await page.locator("#extras-0-fr").fill("Supplément fromage");
  await page.locator("#extras-0-price").fill("100");
  await page.getByRole("button", { name: "Nouveau", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "logo.png"));
  await page.getByRole("button", { name: "Utiliser cette photo" }).click();
  await expect(page.getByRole("button", { name: "Retirer la photo 1" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByRole("link", { name: /Pizza Thon/ })).toBeVisible();
  await expect(page.getByText("900 DA – 1 300 DA")).toBeVisible();

  // Public menu shows it, with sizes and extras.
  await page.goto(`/${slug}?lang=fr`);
  await page.getByRole("button", { name: /Pizza Thon/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Large")).toBeVisible();
  await expect(sheet.getByText("Supplément fromage")).toBeVisible();
  await expect(sheet.locator("img")).toHaveCount(1);

  // Sold out, undo, sold out again.
  await page.goto("/app/menu");
  await page.getByRole("link", { name: /^Pizzas/ }).click();
  const toggle = page.getByRole("switch", { name: "Disponible : Pizza Thon" });
  await toggle.click();
  await expect(page.getByText("« Pizza Thon » marqué épuisé")).toBeVisible();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.waitForTimeout(500);
  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByRole("button", { name: /Pizza Thon/ }).getByText("Épuisé")).toBeVisible();
});

test("category visibility and keyboard reorder", async ({ page }) => {
  const slug = await owner(page);
  await addCategory(page, "Entrées");
  await addItem(page, "Chorba", "300");
  await addCategory(page, "Desserts");
  await addItem(page, "Zlabia", "150");

  await page.goto("/app/menu");
  // Move "Desserts" above "Entrées" with the keyboard.
  await page.getByRole("button", { name: "Déplacer Desserts" }).focus();
  // dnd-kit measures between key presses.
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page.waitForTimeout(1000);
  await page.reload();
  const names = await page.locator("main ul > li a span.font-semibold").allInnerTexts();
  expect(names.slice(0, 2)).toEqual(["Desserts", "Entrées"]);

  await page.getByRole("button", { name: "Masquer Entrées" }).click();
  await expect(page.getByRole("button", { name: "Afficher Entrées" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByRole("button", { name: /Zlabia/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Chorba/ })).toHaveCount(0);
});

test("quick prices, bulk +X DA and translations", async ({ page }) => {
  const slug = await owner(page);
  await addCategory(page, "Boissons");
  await addItem(page, "Café", "100");
  await addItem(page, "Thé", "80");

  await page.goto("/app/menu/prix");
  await page.getByLabel("Prix de Café").fill("120");
  await expect(page.getByText("1 modification non enregistrée")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer les prix" }).click();
  await expect(page.getByText("Prix enregistrés")).toBeVisible();

  await page.getByLabel("Montant (DA)").fill("+30");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("2 prix modifiés")).toBeVisible();
  await expect(page.getByLabel("Prix de Café")).toHaveValue("150");
  await expect(page.getByLabel("Prix de Thé")).toHaveValue("110");

  await page.goto("/app/menu/traductions");
  await expect(page.getByText("3 traductions manquantes")).toBeVisible();
  await page.getByLabel("Plat · Arabe").first().fill("قهوة");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("2 traductions manquantes")).toBeVisible();

  await page.goto(`/${slug}?lang=ar`);
  await expect(page.getByRole("button", { name: /قهوة/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /قهوة/ })).toContainText("150");
});

test("menu schedule hides a category outside its hours", async ({ page }) => {
  const slug = await owner(page);
  await addCategory(page, "Petit-déjeuner");
  await addItem(page, "Msemen", "60");
  await addCategory(page, "Plats");
  await addItem(page, "Couscous", "700");

  // A window 12 hours away from now (Algiers time), every day.
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Algiers", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const start = String((hour + 12) % 24).padStart(2, "0");
  const end = String((hour + 13) % 24).padStart(2, "0");

  await page.goto("/app/menu/horaires");
  await page.getByRole("button", { name: "Nouvel horaire" }).click();
  await page.getByLabel("Nom").fill("Matin");
  await page.getByLabel("De").fill(`${start}:00`);
  await page.getByLabel("À").fill(`${end}:00`);
  await page.getByRole("group", { name: "Catégories concernées" }).getByRole("button", { name: "Petit-déjeuner" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Supprimer l'horaire" })).toBeVisible();

  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByRole("button", { name: /Couscous/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Msemen/ })).toHaveCount(0);
});

test("appearance: template and color with live preview, applied to the public menu", async ({ page }) => {
  const slug = await owner(page);
  await addCategory(page, "Grillades");
  await addItem(page, "Brochettes", "900");

  await page.goto("/app/apparence");
  const preview = page.frameLocator('iframe[title="Aperçu du menu"]');
  await expect(preview.getByText("Brochettes")).toBeVisible();
  await page.getByText("Grill", { exact: true }).first().click();
  await page.getByRole("radio", { name: "Couleur #0F6E6E" }).click();
  await expect(page.locator('iframe[title="Aperçu du menu"]')).toHaveAttribute("src", /\/apercu\/grill\/fr\/.*accent=0F6E6E/);
  await expect(preview.locator('[data-template="grill"]')).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer l'apparence" }).click();
  await expect(page.getByText("Apparence enregistrée")).toBeVisible();

  await page.goto(`/${slug}?lang=fr`);
  await expect(page.locator('[data-template="grill"]')).toBeVisible();
  await expect(page.locator(".menu-root")).toHaveAttribute("style", /--m-accent:\s*#0F6E6E/i);
});

test("tables: add, rename, QR card, PDF of all", async ({ page }) => {
  await owner(page);
  await page.goto("/app/tables");
  await expect(page.getByText(/^Aucune table\. /)).toBeVisible();
  await page.getByRole("button", { name: "Ajouter une table" }).click();
  await page.getByRole("button", { name: "Ajouter une table" }).click();
  await expect(page.getByText("2 tables")).toBeVisible();
  await page.getByLabel("Nom").first().fill("Terrasse 1");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByLabel("Nom").first()).toHaveValue("Terrasse 1");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "QR Terrasse 1 (PNG)" }).click();
  expect((await download).suggestedFilename()).toBe("qr-T1.png");

  const res = await page.request.get("/app/tables/pdf");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("share hub: channel stats and downloads", async ({ page }) => {
  const slug = await owner(page);
  await page.goto(`/${slug}?src=ig&lang=fr`);
  await page.goto(`/${slug}-menu?lang=fr`);
  await page.waitForTimeout(500);

  await page.goto("/app/partager");
  await expect(page.getByText("Instagram").first()).toBeVisible();
  await expect(page.getByText("QR des tables")).toBeVisible();
  await expect(page.getByText(`${slug}?src=ig`, { exact: false })).toBeVisible();

  for (const [name, file] of [
    ["Story Instagram (1080×1920)", `${slug}-story.png`],
    ["Tout télécharger (ZIP)", `${slug}-qr.zip`],
  ]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name }).click();
    expect((await download).suggestedFilename()).toBe(file);
  }
});
