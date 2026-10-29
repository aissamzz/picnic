import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminTotpSecret, db } from "./db";
import { ADMIN, createRestaurant, logIn, rand, randomPhone, signUp } from "./helpers";
import { totp } from "./totp";

test.use({ viewport: { width: 1440, height: 900 } });

/** Admin browser session through the real login + TOTP screens. */
async function admin(browser: Browser): Promise<Page> {
  const secret = await adminTotpSecret();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await logIn(page, ADMIN.phone, ADMIN.password);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await page.getByLabel("Code à 6 chiffres").fill(totp(secret));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("heading", { name: "Vue d'ensemble" })).toBeVisible();
  return page;
}

/** A fresh owner (mobile) with a restaurant; returns its page and ids. */
async function owner(browser: Browser, name = `Admin ${rand()}`) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const phone = randomPhone();
  await signUp(page, phone);
  await createRestaurant(page, name);
  const { data } = await db().from("restaurants").select("id, slug").order("created_at", { ascending: false }).limit(1).single();
  return { page, name, phone, ...data! };
}

test("two-factor is required: wrong code refused, password-only session sees no admin data", async ({ browser }) => {
  const secret = await adminTotpSecret();
  const page = await (await browser.newContext()).newPage();
  await logIn(page, ADMIN.phone, ADMIN.password);
  await expect(page).not.toHaveURL(/\/connexion/);
  await page.goto("/admin/restaurants");
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await page.getByLabel("Code à 6 chiffres").fill(totp(secret, Date.now() - 5 * 60_000));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Code incorrect ou expiré. Réessayez.")).toBeVisible();

  // The database refuses too, whatever the app does.
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: `p${ADMIN.phone.replace(/^0/, "213")}@phone.invalid`, password: ADMIN.password });
  const { error } = await client.rpc("admin_overview");
  expect(error?.message).toBe("forbidden");
  const { data: payments } = await client.from("payments").select("id").limit(1);
  expect(payments).toEqual([]);
});

test("restaurant: search, call log, note, trial extension, read-only view as owner", async ({ browser }) => {
  const o = await owner(browser);
  const page = await admin(browser);

  await page.getByRole("link", { name: "Restaurants" }).click();
  await page.getByLabel("Rechercher (nom, lien, téléphone, commune)").fill(o.name);
  await expect(page.getByText("1 restaurant")).toBeVisible();
  await page.getByRole("cell", { name: new RegExp(o.name) }).click();
  await expect(page.getByRole("heading", { name: o.name, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Appeler" })).toHaveAttribute("href", `tel:+213${o.phone.slice(1)}`);

  await page.getByLabel("Résultat").selectOption("call_back");
  await page.getByLabel("Note", { exact: true }).fill("Rappeler après le service");
  await page.getByRole("button", { name: "Enregistrer l'appel" }).click();
  await expect(page.getByText("Rappeler après le service")).toBeVisible();
  await page.getByRole("textbox", { name: "Ajouter une note" }).fill("Intéressé par le kit");
  await page.getByRole("button", { name: "Ajouter une note" }).click();
  await expect(page.getByText("Intéressé par le kit")).toBeVisible();

  const { data: before } = await db().from("restaurants").select("trial_ends_at").eq("id", o.id).single();
  await page.getByLabel(/Prolonger l'essai/).fill("10");
  await page.getByRole("button", { name: "Prolonger" }).click();
  await expect(page.getByText("admin.trial_extended")).toBeVisible();
  const { data: after } = await db().from("restaurants").select("trial_ends_at").eq("id", o.id).single();
  expect(new Date(after!.trial_ends_at).getTime() - new Date(before!.trial_ends_at).getTime()).toBeGreaterThan(9.9 * 86_400_000);

  // View as owner: dashboard visible, every write refused, then back.
  await page.getByRole("button", { name: "Voir son tableau de bord (lecture seule)" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(`Vous consultez « ${o.name} » en tant qu'admin.`)).toBeVisible();
  const write = await page.request.post("/app/menu", { headers: { "Next-Action": "x" }, data: "[]" });
  expect(write.status()).toBe(403);
  await page.getByRole("button", { name: "Quitter" }).click();
  await expect(page).toHaveURL(/\/admin\/restaurants$/);
  const { data: logs } = await db().from("audit_log").select("action").eq("restaurant_id", o.id);
  expect(logs!.map((l) => l.action)).toEqual(expect.arrayContaining(["admin.call", "admin.note", "admin.trial_extended", "admin.view_as"]));
});

test("payment queue: receipt viewer, approve, reject with a preset reason", async ({ browser }) => {
  const a = await owner(browser, `Payeur ${rand()}`);
  const b = await owner(browser, `Refusé ${rand()}`);
  for (const o of [a, b]) {
    await o.page.goto("/app/abonnement");
    await o.page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "logo.png"));
    await o.page.getByRole("button", { name: "Envoyer le reçu" }).click();
    await expect(o.page.getByText("Reçu en cours de vérification")).toBeVisible();
  }
  const page = await admin(browser);
  await page.getByRole("link", { name: /Paiements/ }).click();
  const cardA = page.getByRole("region", { name: a.name }).or(page.locator(`[aria-label="${a.name}"]`)).first();
  await expect(cardA.getByRole("img", { name: "Reçu" })).toBeVisible();
  await cardA.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText(/Paiement validé, abonnement jusqu'au/)).toBeVisible();

  const cardB = page.locator(`[aria-label="${b.name}"]`).first();
  await cardB.getByRole("button", { name: "Refuser" }).click();
  await page.getByRole("dialog").getByText("Reçu illisible").click();
  await page.getByRole("dialog").getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByText("Reçu refusé.")).toBeVisible();

  await a.page.reload();
  await expect(a.page.getByText("Actif", { exact: true })).toBeVisible();
  await b.page.reload();
  await expect(b.page.getByText("Motif : Reçu illisible")).toBeVisible();
});

test("kit board: mockup upload, drag to the next stage, tracking number", async ({ browser }) => {
  const o = await owner(browser, `Kit ${rand()}`);
  await o.page.goto("/app/kit");
  await o.page.getByLabel("Adresse de livraison").fill("5 rue Didouche");
  await o.page.getByLabel("Téléphone du livreur").fill("0661 22 33 44");
  await o.page.getByRole("button", { name: "Commander le kit" }).click();
  await expect(o.page.getByText("Commande reçue")).toBeVisible();

  const page = await admin(browser);
  await page.getByRole("link", { name: "Kits", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: o.name });
  await card.getByLabel("Envoyer la maquette").setInputFiles({ name: "maquette.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  await expect(page.getByRole("region", { name: "Maquette" }).getByText(o.name)).toBeVisible();

  await o.page.reload();
  await o.page.getByRole("button", { name: "Valider la maquette" }).click();
  await expect(o.page.getByText("Maquette validée, impression en cours.")).toBeVisible();

  // Drag approved -> printed -> shipped (asks for the tracking number).
  async function drag(to: string) {
    await page.reload();
    const handle = page.getByRole("button", { name: new RegExp(`^${o.name} →`) });
    const target = page.getByRole("region", { name: to });
    // The board scrolls sideways; bring the target column into view first.
    await target.scrollIntoViewIfNeeded();
    const from = (await handle.boundingBox())!;
    const dest = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
    await page.mouse.move(dest.x + dest.width / 2, dest.y + 80, { steps: 15 });
    await page.mouse.up();
  }
  await drag("Imprimé");
  await expect(page.getByRole("region", { name: "Imprimé" }).getByText(o.name)).toBeVisible();
  // Backwards (or skipping) is refused.
  await drag("Maquette validée");
  await expect(page.getByText(/Une étape à la fois/)).toBeVisible();
  await drag("Expédié");
  await page.getByRole("dialog").getByLabel("N° de suivi").fill("YAL-4455");
  await page.getByRole("dialog").getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("region", { name: "Expédié" }).getByText("N° de suivi : YAL-4455")).toBeVisible();
});

test("settings, reserved slugs, audit log and CSV export", async ({ browser }) => {
  const page = await admin(browser);
  const { data: s } = await db().from("platform_settings").select("price_monthly").single();
  const original = String(s!.price_monthly);
  try {
    await page.getByRole("link", { name: "Réglages" }).click();
    await page.getByLabel("Jours de grâce").fill("99");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Valeurs hors limites : vérifiez les champs.").first()).toBeVisible();
    await page.getByLabel("Jours de grâce").fill("7");
    await page.getByLabel("Mensuel").fill("2600");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
    const { data: after } = await db().from("platform_settings").select("price_monthly").single();
    expect(after!.price_monthly).toBe(2600);
  } finally {
    await (await import("./db")).adminClient().then((c) => c.rpc("admin_update_settings", { p: { price_monthly: Number(original) } }));
  }

  const slug = `promo-${rand()}`;
  await page.getByRole("link", { name: "Modèles et liens" }).click();
  await page.getByRole("textbox", { name: "Liens réservés" }).fill("pizzeria-roma");
  await page.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByText("Ce lien est déjà utilisé par un restaurant.")).toBeVisible();
  await page.getByRole("textbox", { name: "Liens réservés" }).fill(slug);
  await page.getByRole("button", { name: "Réserver" }).click();
  await expect(page.getByText(slug, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Libérer ${slug}` }).click();
  await expect(page.getByText(slug, { exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Journal" }).click();
  await page.getByLabel("Action").fill("admin.");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page.getByRole("cell", { name: "admin.settings" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "admin.slug_released" }).first()).toBeVisible();
  const csv = await page.request.get("/admin/journal/export?action=admin.slug");
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain(slug);
});
