import { expect, type Browser, type Page } from "@playwright/test";

export const ADMIN = {
  phone: process.env.E2E_ADMIN_PHONE ?? "0555000009",
  password: process.env.E2E_ADMIN_PASSWORD ?? "admin-pass-123",
};

/** A fresh mobile number per test run: 06 + 8 digits. */
export function randomPhone(): string {
  return `06${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

export function rand(): string {
  return Math.random().toString(36).slice(2, 7);
}

export async function signUp(page: Page, phone: string, password = "secret-pass-1", name = "Test Owner") {
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill(name);
  await page.getByLabel("Numéro de téléphone").fill(phone);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Confirmez le mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/1$/);
}

export async function logIn(page: Page, phone: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Numéro de téléphone").fill(phone);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Step 1 only: enough for the owner shell to open. */
export async function createRestaurant(page: Page, name: string) {
  await page.getByLabel("Nom du restaurant").fill(name);
  await page.getByLabel("Wilaya").selectOption("18");
  await expect(page.getByText("Disponible")).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/app\/onboarding\/2$/);
}

export async function adminPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await logIn(page, ADMIN.phone, ADMIN.password);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto("/admin/codes");
  await expect(page.getByRole("heading", { name: "Codes de vérification" })).toBeVisible();
  return page;
}

/** Admin generates the code for the request of `phone` and returns it. */
export async function adminIssueCode(admin: Page, phoneDisplay: string): Promise<string> {
  const card = admin.locator("article, div").filter({ has: admin.getByRole("link", { name: phoneDisplay }) }).filter({ has: admin.getByRole("button", { name: /Générer le code|Nouveau code/ }) }).last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: /Générer le code|Nouveau code/ }).click();
  const code = await card.getByTestId("issued-code").innerText();
  return code.replace(/\D/g, "");
}

export function displayPhone(local: string): string {
  return `${local.slice(0, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}
