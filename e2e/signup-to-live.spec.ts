import path from "node:path";
import { expect, test } from "@playwright/test";
import { rand, randomPhone } from "./helpers";

test("new owner signs up and reaches the live screen with a working slug", async ({ page }) => {
  const phone = randomPhone();
  const name = `Grill Test ${rand()}`;

  // Signup: no SMS, password twice.
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Amine Test");
  await page.getByLabel("Numéro de téléphone").fill(phone);
  await page.getByLabel("Mot de passe", { exact: true }).fill("secret-pass-1");
  await page.getByLabel("Confirmez le mot de passe").fill("secret-pass-2");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Les deux mots de passe ne correspondent pas.")).toBeVisible();
  await page.getByLabel("Confirmez le mot de passe").fill("secret-pass-1");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/1$/);

  // Step 1: infos + logo.
  await page.getByLabel("Nom du restaurant").fill(name);
  await page.getByLabel("Type d'établissement").selectOption("grill");
  await page.getByLabel("Wilaya").selectOption("18");
  await page.getByLabel("Commune").fill("Jijel");
  await expect(page.getByText("Disponible")).toBeVisible();
  const slug = await page.getByLabel("Votre lien").inputValue();
  expect(slug).toMatch(/^grill-test-[a-z0-9]+$/);
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "logo.png"));
  await page.getByRole("button", { name: "Utiliser ce logo" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 2: template (grill suggested for a grill).
  await expect(page).toHaveURL(/\/onboarding\/2$/);
  await expect(page.getByText("Suggéré")).toBeVisible();
  await page.getByText("Fruits de mer", { exact: true }).first().click();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 3: manual entry, FR + AR, messy price.
  await expect(page).toHaveURL(/\/onboarding\/3$/);
  await page.getByRole("button", { name: "Saisir à la main" }).click();
  await page.getByLabel("Nom en français").fill("Grillades");
  await page.getByLabel("Nom en arabe").fill("مشويات");
  await page.getByRole("button", { name: "Ajouter une catégorie" }).click();
  await expect(page.getByRole("heading", { name: "Grillades" })).toBeVisible();
  const itemForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Ajouter un plat" }) });
  await itemForm.getByLabel("Nom en français").fill("Brochettes");
  await itemForm.getByLabel("Prix (DA)").fill("1.200");
  await itemForm.getByRole("button", { name: "Ajouter un plat" }).click();
  await expect(page.getByText("Brochettes")).toBeVisible();
  await expect(page.getByText("1 200 DA")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 5: languages, fill the missing Arabic name.
  await expect(page).toHaveURL(/\/onboarding\/5$/);
  await page.getByLabel("Brochettes → Arabe").fill("براشيت");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 6: tables.
  await expect(page).toHaveURL(/\/onboarding\/6$/);
  await page.getByLabel("Nombre de tables").fill("6");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 7: live.
  await expect(page).toHaveURL(/\/onboarding\/7$/);
  await expect(page.getByRole("heading", { name: "Vous êtes en ligne !" })).toBeVisible();
  await expect(page.getByText(`/${slug}-menu`)).toBeVisible();
  await expect(page.getByRole("img", { name: new RegExp(`QR code vers .*/${slug}$`) })).toBeVisible();

  // The links work.
  await page.goto(`/${slug}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Brochettes")).toBeVisible();
  await page.goto(`/${slug}-menu?t=T2`);
  await expect(page.getByText("Table 2")).toBeVisible();

  // Dashboard shows the finished setup.
  await page.goto("/app");
  await expect(page.getByText("Terminez la configuration")).toHaveCount(0);
  await expect(page.getByText(`/${slug}`, { exact: false }).first()).toBeVisible();
});
