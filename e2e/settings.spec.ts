import { expect, test } from "@playwright/test";
import { db } from "./db";
import { createRestaurant, rand, randomPhone, signUp } from "./helpers";

test("restaurant info: link change warns and the old link redirects", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Infos ${rand()}`);
  await page.goto("/app/plus");
  await page.getByRole("link", { name: "Restaurant" }).click();
  await expect(page.getByRole("heading", { name: "Infos du restaurant" })).toBeVisible();
  const oldSlug = await page.getByLabel("Votre lien").inputValue();
  const newSlug = `nouveau-${rand()}`;
  await page.getByLabel("Votre lien").fill(newSlug);
  await expect(page.getByRole("alert").filter({ hasText: "redirigera vers le nouveau" })).toBeVisible();
  await expect(page.getByText("Disponible")).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Infos enregistrées.")).toBeVisible();
  await page.goto(`/${oldSlug}`);
  await expect(page).toHaveURL(new RegExp(`/${newSlug}`));
});

test("hours, closing day and links show on the menu", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Horaires ${rand()}`);
  const slug = (await db().from("restaurants").select("slug").order("created_at", { ascending: false }).limit(1).single()).data!.slug;
  await page.goto("/app/reglages/horaires-liens");
  await page.getByRole("switch", { name: "Ouvert le samedi" }).click();
  await page.getByRole("button", { name: "Copier sur tous les jours" }).click();
  await expect(page.getByRole("switch", { name: "Ouvert le vendredi" })).toBeChecked();

  // Closed today, whatever the hours say.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Algiers" }).format(new Date());
  await page.getByRole("button", { name: "Ajouter une date" }).click();
  await page.getByLabel("Date", { exact: true }).fill(today);
  await page.getByLabel("Motif (facultatif)").fill("Inventaire");
  await page.getByLabel("Instagram").fill("@horaires_test");
  await page.getByLabel("Lien Google Maps").fill("maps.google.com/x");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Lien invalide : il doit commencer par https://").first()).toBeVisible();
  await page.getByLabel("Lien Google Maps").fill("https://maps.app.goo.gl/test");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Horaires et liens enregistrés.")).toBeVisible();

  const { data: rows } = await db().from("opening_hours").select("weekday").eq("restaurant_id", (await db().from("restaurants").select("id").eq("slug", slug).single()).data!.id);
  expect(rows).toHaveLength(7);
  await page.goto(`/${slug}?lang=fr`);
  await expect(page.getByText("Fermé").first()).toBeVisible();
  await page.getByRole("button", { name: "Infos" }).first().click();
  await expect(page.getByRole("dialog").getByText("Inventaire")).toBeVisible();
  await expect(page.getByRole("dialog").locator('a[href="https://instagram.com/horaires_test"]')).toBeVisible();
});

test("team: invite a waiter by link, they join, the owner removes them", async ({ page, browser }) => {
  await signUp(page, randomPhone());
  const name = `Equipe ${rand()}`;
  await createRestaurant(page, name);
  await page.goto("/app/equipe");
  const waiterPhone = randomPhone();
  await page.getByLabel("Numéro du serveur").fill(waiterPhone);
  await page.getByRole("button", { name: "Créer l'invitation" }).click();
  await expect(page.getByText("Invitation prête. Envoyez ce lien :")).toBeVisible();
  const url = (await page.getByRole("status").filter({ hasText: "Invitation prête" }).locator("p[dir=ltr]").innerText()).trim();
  expect(url).toMatch(/\/invitation\/[0-9a-f]{64}$/);
  await expect(page.getByText("Invitations en attente")).toBeVisible();

  const waiter = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await waiter.goto(new URL(url).pathname);
  await expect(waiter.getByText(`${name} vous invite`)).toBeVisible();
  await waiter.getByRole("link", { name: "Créer un compte" }).click();
  await waiter.getByLabel("Votre nom").fill("Samir Serveur");
  await waiter.getByLabel("Numéro de téléphone").fill(waiterPhone);
  await waiter.getByLabel("Mot de passe", { exact: true }).fill("secret-pass-1");
  await waiter.getByLabel("Confirmez le mot de passe").fill("secret-pass-1");
  await waiter.getByRole("button", { name: "Créer mon compte" }).click();
  await waiter.getByRole("button", { name: "Rejoindre l'équipe" }).click();
  await expect(waiter).toHaveURL(/\/app$/);
  await expect(waiter.getByText(name).first()).toBeVisible();
  // Staff see no billing and no team screen.
  await waiter.goto("/app/plus");
  await expect(waiter.getByRole("link", { name: "Équipe" })).toHaveCount(0);
  await expect(waiter.getByRole("link", { name: "Abonnement" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Samir Serveur")).toBeVisible();
  await expect(page.getByText("Invitations en attente")).toHaveCount(0);
  await page.getByRole("button", { name: "Retirer Samir Serveur" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("C'est fait.")).toBeVisible();
  await expect(page.getByText("Samir Serveur")).toHaveCount(0);
});
