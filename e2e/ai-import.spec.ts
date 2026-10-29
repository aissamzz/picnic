import path from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "./db";
import { createRestaurant, rand, randomPhone, signUp } from "./helpers";

// Runs against AI_PROVIDER=fixture (written by the local stack): the file name picks the canned menu.
const fixture = (name: string) => path.join(__dirname, "fixtures", name);

/** The restaurant just created by this test (tests run one at a time). */
async function newestRestaurantId(): Promise<string> {
  const { data } = await db().from("restaurants").select("id").order("created_at", { ascending: false }).limit(1).single();
  return data!.id;
}

test("onboarding: photos -> review (flags, duplicate merge, fixes) -> menu -> auto-translate", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Import ${rand()}`);
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/onboarding\/3$/);
  await expect(page.getByText("5 imports restants pendant l'essai")).toBeVisible();

  await page.getByLabel("Choisir des photos").setInputFiles([fixture("menu-p1.jpg"), fixture("menu-p2.jpg")]);
  await expect(page.getByRole("img", { name: "Photo 2" })).toBeVisible();
  await page.getByRole("button", { name: "Lire mon menu" }).click();

  // Review.
  await expect(page).toHaveURL(/\/onboarding\/4\?import=/);
  await expect(page.getByRole("heading", { name: "Vérifiez votre menu" })).toBeVisible();
  await expect(page.getByText("2 champs à vérifier")).toBeVisible();
  // Prices were printed "1.100" and "15 00".
  await expect(page.getByLabel("Prix 1")).toHaveValue("1100");
  await expect(page.getByLabel("Prix 2")).toHaveValue("1500");
  // Low-confidence name, fixed by the owner.
  const juice = page.getByLabel("Nom en français").and(page.locator('[aria-invalid="true"]'));
  await expect(juice).toHaveValue("Jus d'orage");
  await juice.fill("Jus d'orange");
  await page.getByLabel("Prix 1").fill("1200");
  await expect(page.getByText("Tout semble correct")).toBeVisible();
  // "Cafe" duplicates "Café": merge.
  await expect(page.getByText("Doublon possible de « Café »")).toBeVisible();
  await page.getByRole("button", { name: "Fusionner" }).click();
  await expect(page.getByText(/Doublon possible/)).toHaveCount(0);
  // The second photo's dessert can go.
  await page.getByRole("button", { name: "Retirer la catégorie Desserts" }).click();
  await page.getByRole("button", { name: "Ajouter 5 plats au menu" }).click();

  // Languages: auto-translate the missing Arabic names, then save.
  await expect(page).toHaveURL(/\/onboarding\/5$/);
  await page.getByRole("button", { name: "Traduire automatiquement" }).click();
  await expect(page.getByLabel("Pizza 4 Fromages → Arabe")).toHaveValue("بيتزا 4 أجبان");
  await expect(page.getByLabel("Jus d'orange → Arabe")).toHaveValue("عصير برتقال");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page).toHaveURL(/\/onboarding\/6$/);

  const rid = await newestRestaurantId();
  const { data: items } = await db().from("items").select("name, base_price, item_variants(name, price)").eq("restaurant_id", rid).order("name->>fr");
  expect(items!.map((i) => i.name)).toEqual([
    { fr: "Café", ar: "قهوة" },
    { fr: "Jus d'orange", ar: "عصير برتقال" },
    { fr: "Pizza 4 Fromages", ar: "بيتزا 4 أجبان" },
    { fr: "Pizza Margherita", ar: "بيتزا مارغريتا" },
    { fr: "Pizza Thon", ar: "بيتزا تونة" },
  ]);
  const four = items!.find((i) => (i.name as { fr: string }).fr === "Pizza 4 Fromages")!;
  expect(four.base_price).toBeNull();
  expect(four.item_variants.map((v) => v.price).sort()).toEqual([1200, 1500]);
  expect(items!.find((i) => (i.name as { fr: string }).fr === "Café")!.base_price).toBe(150);
});

test("menu importer: blurry photo, Arabic-only PDF, translations screen, trial quota", async ({ page }) => {
  await signUp(page, randomPhone());
  await createRestaurant(page, `Arabe ${rand()}`);
  const rid = await newestRestaurantId();

  await page.goto("/app/menu");
  await page.getByRole("link", { name: /Importer depuis une photo/ }).click();
  await expect(page).toHaveURL(/\/app\/menu\/importer$/);

  // Blurry: failed state with tips and retry, nothing counted against the quota.
  await page.getByLabel("Choisir des photos").setInputFiles(fixture("menu-blurry.jpg"));
  await page.getByRole("button", { name: "Lire mon menu" }).click();
  await expect(page.getByText("Nous n'avons pas pu lire ce menu")).toBeVisible();
  await expect(page.getByText("La photo est trop floue ou trop sombre pour être lue.")).toBeVisible();
  await expect(page.getByText("Évitez le flash et les reflets.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("5 imports restants pendant l'essai")).toBeVisible();

  // Arabic-only handwritten menu as PDF.
  await page.getByLabel("Importer un PDF").setInputFiles(fixture("menu-arabe.pdf"));
  await expect(page.getByText("menu-arabe.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Lire mon menu" }).click();
  await expect(page).toHaveURL(/\/app\/menu\/importer\/[0-9a-f-]+$/);
  await expect(page.getByText(/Une partie du menu n'a pas pu être lue/)).toBeVisible();
  await expect(page.getByText("2 champs à vérifier")).toBeVisible();
  await expect(page.getByLabel("Nom en arabe").first()).toHaveValue("محاجب");
  await page.getByRole("button", { name: "Ajouter 3 plats au menu" }).click();
  await expect(page).toHaveURL(/\/app\/menu$/);
  await expect(page.getByText("أكل خفيف")).toBeVisible();
  const { data: arabic } = await db().from("items").select("name, base_price").eq("restaurant_id", rid).order("position");
  expect(arabic).toEqual([
    { name: { ar: "محاجب" }, base_price: 60 },
    { name: { ar: "كرانتيكا" }, base_price: 50 },
    { name: { ar: "شوربة" }, base_price: null },
  ]);

  // French names via the translations screen.
  await page.goto("/app/menu/traductions");
  await page.getByRole("button", { name: "Traduire automatiquement" }).click();
  await expect(page.getByLabel("Plat · Français").first()).toHaveValue("Mhadjeb");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Tout est traduit")).toBeVisible();
  const { data: cat } = await db().from("categories").select("name").eq("restaurant_id", rid).single();
  expect(cat!.name).toEqual({ fr: "Snacks", ar: "أكل خفيف" });

  // Quota: used imports (failed ones don't count) leave none.
  await db()
    .from("ai_imports")
    .insert(Array.from({ length: 4 }, () => ({ restaurant_id: rid, source_paths: ["x"], status: "done" as const })));
  await page.goto("/app/menu/importer");
  await expect(page.getByText("Plus d'import disponible pendant l'essai")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prendre en photo" })).toBeDisabled();
});
