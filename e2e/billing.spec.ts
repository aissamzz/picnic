import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, db } from "./db";
import { createRestaurant, rand, randomPhone, signUp } from "./helpers";

const receipt = path.join(__dirname, "fixtures", "logo.png");

/** Newest restaurant (tests run one at a time). */
async function newest() {
  const { data } = await db().from("restaurants").select("id, slug, referral_code").order("created_at", { ascending: false }).limit(1).single();
  return data!;
}

async function owner(page: Page, name = `Abo ${rand()}`) {
  await signUp(page, randomPhone());
  await createRestaurant(page, name);
  return newest();
}

test("trial to paid: plan, CCP details, receipt, admin approval, PDF receipt, notification", async ({ page }) => {
  const r = await owner(page);
  await page.goto("/app/plus");
  await page.getByRole("link", { name: "Abonnement" }).click();
  await expect(page.getByRole("heading", { name: "Abonnement", level: 1 })).toBeVisible();
  await expect(page.getByText(/^QR-\d{4,}$/).first()).toBeVisible();
  await expect(page.getByText(/Essai jusqu'au/)).toBeVisible();

  // Six months by CCP: prices and details come from the platform settings.
  await page.getByRole("radio", { name: /6 mois/ }).check();
  await expect(page.getByText("−10 %")).toBeVisible();
  await page.getByText("Versement CCP", { exact: true }).click();
  await expect(page.getByText("LIINKY SARL")).toBeVisible();
  await expect(page.getByText(/^13\s500\sDA$/).last()).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(receipt);
  await page.getByRole("button", { name: "Envoyer le reçu" }).click();
  await expect(page.getByText("Reçu en cours de vérification")).toBeVisible();
  await expect(page.getByText("En vérification")).toBeVisible();

  // Admin approves (admin screens arrive in phase 8; the RPC is what they call).
  const { data: pay } = await db().from("payments").select("id, amount, method, receipt_path").eq("restaurant_id", r.id).single();
  expect(pay).toMatchObject({ amount: 13500, method: "ccp" });
  expect(pay!.receipt_path).toMatch(new RegExp(`^${r.id}/.+\\.jpg$`));
  const admin = await adminClient();
  const { error } = await admin.rpc("approve_payment", { p_payment_id: pay!.id });
  expect(error).toBeNull();

  await page.reload();
  await expect(page.getByText("Actif", { exact: true })).toBeVisible();
  await expect(page.getByText(/Valable jusqu'au/)).toBeVisible();
  await expect(page.getByText("Validé")).toBeVisible();
  const res = await page.request.get(`/app/abonnement/recu/${pay!.id}`);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");

  // In-app notification instead of an SMS.
  await page.getByRole("link", { name: /Notifications, 1 nouvelle/ }).click();
  await expect(page.getByText(/Paiement validé\. Abonnement actif jusqu'au/)).toBeVisible();
  await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
  await expect(page.getByRole("link", { name: /Notifications, aucune nouvelle/ })).toBeVisible();
});

test("rejected receipt shows the reason; one pending receipt at a time", async ({ page }) => {
  const r = await owner(page);
  await page.goto("/app/abonnement");
  await page.getByRole("radio", { name: /Mensuel/ }).check();
  await page.locator('input[type="file"]').setInputFiles(receipt);
  await page.getByRole("button", { name: "Envoyer le reçu" }).click();
  await expect(page.getByText("Reçu en cours de vérification")).toBeVisible();
  const { data: pay } = await db().from("payments").select("id").eq("restaurant_id", r.id).single();
  const admin = await adminClient();
  await admin.rpc("reject_payment", { p_payment_id: pay!.id, p_reason: "Montant illisible" });
  await page.reload();
  await expect(page.getByText("Motif : Montant illisible")).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer le reçu" })).toBeVisible();
});

test("kit: order, mockup changes then approval, delivery, COD activates the annual plan", async ({ page }) => {
  const r = await owner(page);
  await page.goto("/app/kit");
  await expect(page.getByText(/^30\s000\sDA$/)).toBeVisible();
  await page.getByLabel("Adresse de livraison").fill("12 rue Larbi Ben M'hidi");
  await page.getByLabel("Téléphone du livreur").fill("0661 22 33 44");
  await page.getByRole("button", { name: "Commander le kit" }).click();
  await expect(page.getByText("Commande reçue")).toBeVisible();
  const { data: kit } = await db().from("kit_orders").select("id, cod_amount, phone").eq("restaurant_id", r.id).single();
  expect(kit).toMatchObject({ cod_amount: 30000, phone: "+213661223344" });

  const admin = await adminClient();
  const mockup = `${r.id}/${kit!.id}/mockup.pdf`;
  await db().storage.from("kit").upload(mockup, Buffer.from("%PDF-1.4\n%%EOF\n"), { contentType: "application/pdf" });
  await admin.rpc("kit_set_mockup", { p_kit_id: kit!.id, p_path: mockup });
  await page.reload();
  await expect(page.getByRole("link", { name: "Ouvrir la maquette" })).toBeVisible();
  await page.getByRole("button", { name: "Demander des modifications" }).click();
  await page.getByLabel("Ce qu'il faut changer").fill("Logo plus grand");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/Modifications demandées : « Logo plus grand »/)).toBeVisible();

  await admin.rpc("kit_set_mockup", { p_kit_id: kit!.id, p_path: mockup });
  await page.reload();
  await page.getByRole("button", { name: "Valider la maquette" }).click();
  await expect(page.getByText("Maquette validée, impression en cours.")).toBeVisible();

  for (const [stage, tracking] of [["printed"], ["shipped", "YAL-778899"], ["delivered"], ["paid"]] as const) {
    const { error } = await admin.rpc("kit_advance", { p_kit_id: kit!.id, p_stage: stage, p_tracking: tracking });
    expect(error).toBeNull();
  }
  await page.reload();
  await expect(page.getByText("N° de suivi : YAL-778899")).toBeVisible();
  await expect(page.getByText("Kit payé : votre abonnement de 12 mois est actif.")).toBeVisible();
  await page.goto("/app/abonnement");
  await expect(page.getByText("12 mois", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/À la livraison du kit/)).toBeVisible();
});

test("referral link credits a month; expired restaurants are locked but stay online", async ({ page, browser }) => {
  const referrer = await owner(page, `Parrain ${rand()}`);
  await page.goto("/app/parrainage");
  await expect(page.getByText(referrer.referral_code, { exact: true })).toBeVisible();
  await expect(page.getByText("Aucun filleul pour le moment.")).toBeVisible();

  // A friend signs up through the link.
  const friend = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await friend.goto(`/inscription?ref=${referrer.referral_code}`);
  const friendR = await owner(friend, `Filleul ${rand()}`);
  const { data: link } = await db().from("restaurants").select("referred_by").eq("id", friendR.id).single();
  expect(link!.referred_by).toBe(referrer.id);

  await friend.goto("/app/abonnement");
  await friend.locator('input[type="file"]').setInputFiles(receipt);
  await friend.getByRole("button", { name: "Envoyer le reçu" }).click();
  await expect(friend.getByText("Reçu en cours de vérification")).toBeVisible();
  const { data: pay } = await db().from("payments").select("id").eq("restaurant_id", friendR.id).single();
  await (await adminClient()).rpc("approve_payment", { p_payment_id: pay!.id });

  await page.reload();
  await expect(page.getByText("1 mois gagné")).toBeVisible();
  const { data: trial } = await db().from("restaurants").select("trial_ends_at").eq("id", referrer.id).single();
  expect(new Date(trial!.trial_ends_at).getTime()).toBeGreaterThan(Date.now() + 40 * 86_400_000);

  // Trial long over: the request guard expires it on the next visit.
  await db().from("restaurants").update({ trial_ends_at: new Date(Date.now() - 30 * 86_400_000).toISOString() }).eq("id", referrer.id);
  await page.goto("/app/menu");
  await expect(page.getByText(/Abonnement expiré\. Votre menu reste en ligne/)).toBeVisible();
  await expect(page.getByText("Modification bloquée")).toBeVisible();
  await page.getByRole("link", { name: "Réactiver" }).first().click();
  await expect(page).toHaveURL(/\/app\/abonnement$/);
  const res = await page.request.get(`/${referrer.slug}`);
  expect(res.status()).toBe(200);
});
