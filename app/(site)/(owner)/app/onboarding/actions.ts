"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { getMyRestaurant, requireOwnerRestaurant, requireSession } from "@/lib/auth/session";
import { REFERRAL_COOKIE } from "@/lib/config";
import { resolveLocale } from "@/lib/i18n/request";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { slugCandidates } from "@/lib/slug";
import { toWebp } from "@/lib/storage/images";
import { PUBLIC_BUCKET } from "@/lib/storage";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  categoryInputSchema,
  infoSchema,
  itemInputSchema,
  languagesSchema,
  tablesSchema,
  templateSchema,
} from "@/lib/validation/onboarding";

/** Next step after `step`. Step 4 (AI review) is only reached from an import in step 3. */
function nextStep(step: number) {
  return step === 3 ? 5 : step + 1;
}

async function advance(restaurantId: string, current: number, step: number) {
  const target = nextStep(step);
  if (current < target) {
    const supabase = await createClient();
    await supabase.from("restaurants").update({ onboarding_step: target }).eq("id", restaurantId);
  }
  revalidatePath("/app", "layout");
  redirect(target > 7 ? "/app" : `/app/onboarding/${target}`);
}

/** "Passer" / "Continuer" without changes. */
export async function skipStep(step: number) {
  const r = await requireOwnerRestaurant();
  await advance(r.id, r.onboarding_step, step);
}

// ---------------------------------------------------------------------------
// Step 1: infos
// ---------------------------------------------------------------------------

export async function checkSlug(input: { slug: string; name: string; commune?: string }): Promise<{
  available: boolean;
  suggestion: string | null;
}> {
  await requireSession();
  const mine = await getMyRestaurant();
  const supabase = await createClient();
  const isFree = async (slug: string) => {
    const { data } = await supabase.rpc("is_slug_available", { p_slug: slug, p_restaurant_id: mine?.id });
    return data === true;
  };
  const available = input.slug ? await isFree(input.slug) : false;
  if (available) return { available, suggestion: null };
  for (const c of slugCandidates(input.name, input.commune)) {
    if (c !== input.slug && (await isFree(c))) return { available, suggestion: c };
  }
  return { available, suggestion: null };
}

export async function saveInfo(input: z.input<typeof infoSchema>): Promise<ActionResult<{ restaurantId: string }>> {
  await requireSession();
  const parsed = infoSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const supabase = await createClient();
  const existing = await getMyRestaurant();

  if (!existing) {
    const { data, error } = await supabase.rpc("create_restaurant", {
      p_name: v.name,
      p_slug: v.slug,
      p_type: v.type,
      p_wilaya_code: v.wilayaCode,
      p_commune: v.commune,
      p_address: v.address,
      p_whatsapp_order_phone: v.whatsapp ?? undefined,
      p_referral_code: (await cookies()).get(REFERRAL_COOKIE)?.value,
    });
    if (error || !data) {
      if (error?.message.includes("slug_unavailable")) return fail("errors.slugUnavailable", { slug: "errors.slugUnavailable" });
      if (error?.message.includes("already_owner")) return fail("errors.alreadyOwner");
      console.error("create_restaurant", error);
      return fail("errors.generic");
    }
    (await cookies()).delete(REFERRAL_COOKIE);
    // The menu's default language follows the language the owner set up in.
    await supabase.from("restaurants").update({ default_locale: await resolveLocale() }).eq("id", data);
    revalidateMenu(v.slug);
    return { ok: true, data: { restaurantId: data } };
  }

  if (existing.role !== "owner") return fail("errors.forbidden");
  if (v.slug !== existing.slug) {
    const { error } = await supabase.rpc("change_slug", { p_restaurant_id: existing.id, p_new_slug: v.slug });
    if (error) return fail(error.message.includes("slug_unavailable") ? "errors.slugUnavailable" : "errors.generic", { slug: "errors.slugUnavailable" });
  }
  const { error } = await supabase
    .from("restaurants")
    .update({
      name: v.name,
      type: v.type,
      wilaya_code: v.wilayaCode,
      commune: v.commune || null,
      address: v.address || null,
      whatsapp_order_phone: v.whatsapp,
      // Onboarding turns ordering on with the number; later edits leave the switch alone.
      ...(existing.onboarding_step <= 1 ? { orders_enabled: v.whatsapp !== null } : v.whatsapp === null ? { orders_enabled: false } : {}),
    })
    .eq("id", existing.id);
  if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  revalidateMenu(existing.slug, v.slug);
  return { ok: true, data: { restaurantId: existing.id } };
}

export async function uploadLogo(form: FormData): Promise<ActionResult<{ path: string }>> {
  const r = await requireOwnerRestaurant();
  const file = form.get("logo");
  if (!(file instanceof File)) return fail("errors.imageInvalid");
  let webp: Buffer;
  try {
    // Any shape (wide logos too): the menu shows it whole on a white tile.
    webp = await toWebp(file, { width: 800, height: 400, fit: "inside" });
  } catch {
    return fail("errors.imageInvalid");
  }
  // Uploads go through the server (resize + validation), with the service key.
  const path = `${r.id}/logo-${Date.now()}.webp`;
  const service = createServiceClient();
  const { error: upErr } = await service.storage.from(PUBLIC_BUCKET).upload(path, webp, { contentType: "image/webp", upsert: true });
  if (upErr) {
    console.error("uploadLogo", upErr);
    return fail("errors.generic");
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("restaurants").select("logo_path").eq("id", r.id).single();
  const { error } = await supabase.from("restaurants").update({ logo_path: path }).eq("id", r.id);
  if (error) return fail("errors.locked");
  if (before?.logo_path) await service.storage.from(PUBLIC_BUCKET).remove([before.logo_path]);
  revalidatePath("/app", "layout");
  revalidateMenu(r.slug);
  return { ok: true, data: { path } };
}

export async function removeLogo(): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { data: before } = await supabase.from("restaurants").select("logo_path").eq("id", r.id).single();
  const { error } = await supabase.from("restaurants").update({ logo_path: null }).eq("id", r.id);
  if (error) return fail("errors.locked");
  if (before?.logo_path) await createServiceClient().storage.from(PUBLIC_BUCKET).remove([before.logo_path]);
  revalidatePath("/app", "layout");
  revalidateMenu(r.slug);
  return { ok: true };
}

/** After step 1 (and the optional logo upload), move on. */
export async function finishInfo() {
  const r = await requireOwnerRestaurant();
  await advance(r.id, r.onboarding_step, 1);
}

// ---------------------------------------------------------------------------
// Step 2: template
// ---------------------------------------------------------------------------

export async function saveTemplate(input: z.input<typeof templateSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic");
  const supabase = await createClient();
  const { error } = await supabase.from("restaurants").update({ template_key: parsed.data.templateKey }).eq("id", r.id);
  if (error) return fail("errors.locked");
  revalidateMenu(r.slug);
  await advance(r.id, r.onboarding_step, 2);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 3: manual menu entry
// ---------------------------------------------------------------------------

export async function addCategory(input: z.input<typeof categoryInputSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).is("deleted_at", null);
  const { error } = await supabase.from("categories").insert({ restaurant_id: r.id, name: parsed.data.name, position: (count ?? 0) + 1 });
  if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  revalidatePath("/app/onboarding/3");
  revalidateMenu(r.slug);
  return { ok: true };
}

export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("restaurant_id", r.id);
  if (error) return fail("errors.generic");
  revalidatePath("/app/onboarding/3");
  revalidateMenu(r.slug);
  return { ok: true };
}

export async function addItem(input: z.input<typeof itemInputSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("category_id", parsed.data.categoryId)
    .is("deleted_at", null);
  const { error } = await supabase.from("items").insert({
    restaurant_id: r.id,
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    base_price: parsed.data.price,
    position: (count ?? 0) + 1,
  });
  if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  revalidatePath("/app/onboarding/3");
  revalidateMenu(r.slug);
  return { ok: true };
}

export async function deleteItem(itemId: string): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("restaurant_id", r.id);
  if (error) return fail("errors.generic");
  revalidatePath("/app/onboarding/3");
  revalidateMenu(r.slug);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 5: languages
// ---------------------------------------------------------------------------

export async function saveLanguages(input: z.input<typeof languagesSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = languagesSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "errors.generic");
  const { enabled, translations } = parsed.data;
  const defaultLocale = enabled.includes(parsed.data.defaultLocale) ? parsed.data.defaultLocale : enabled[0];
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ enabled_locales: enabled, default_locale: defaultLocale })
    .eq("id", r.id);
  if (error) return fail("errors.locked");

  for (const tr of translations.filter((x) => x.value)) {
    const table = tr.kind === "category" ? "categories" : "items";
    const { data: row } = await supabase.from(table).select("name").eq("id", tr.id).eq("restaurant_id", r.id).single();
    if (!row) continue;
    const name = { ...(row.name as Record<string, string>), [tr.locale]: tr.value };
    await supabase.from(table).update({ name }).eq("id", tr.id).eq("restaurant_id", r.id);
  }
  revalidateMenu(r.slug);
  await advance(r.id, r.onboarding_step, 5);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 6: tables (T1..Tn)
// ---------------------------------------------------------------------------

export async function saveTables(input: z.input<typeof tablesSchema>, labelTemplate: string): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = tablesSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic");
  const n = parsed.data.count;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tables").select("id, code").eq("restaurant_id", r.id);
  const byCode = new Map((existing ?? []).map((t) => [t.code, t.id]));
  const label = (i: number) => labelTemplate.replace("{n}", String(i)).slice(0, 40);

  const rows = Array.from({ length: n }, (_, k) => k + 1).filter((i) => !byCode.has(`T${i}`));
  if (rows.length) {
    const { error } = await supabase
      .from("tables")
      .insert(rows.map((i) => ({ restaurant_id: r.id, code: `T${i}`, label: label(i), position: i })));
    if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  }
  // Keep tables above n (and any custom ones) but hide the generated extras.
  const codes = Array.from({ length: n }, (_, k) => `T${k + 1}`);
  await supabase.from("tables").update({ is_active: true }).eq("restaurant_id", r.id).in("code", codes.length ? codes : ["-"]);
  const extras = (existing ?? []).filter((t) => /^T\d+$/.test(t.code) && Number(t.code.slice(1)) > n).map((t) => t.id);
  if (extras.length) await supabase.from("tables").update({ is_active: false }).in("id", extras);
  revalidateMenu(r.slug);
  await advance(r.id, r.onboarding_step, 6);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Step 7: live
// ---------------------------------------------------------------------------

export async function markLive(): Promise<void> {
  const r = await requireOwnerRestaurant();
  if (r.went_live_at && r.onboarding_step >= 8) return;
  const supabase = await createClient();
  await supabase
    .from("restaurants")
    .update({ onboarding_step: 8, ...(r.went_live_at ? {} : { went_live_at: new Date().toISOString() }) })
    .eq("id", r.id);
}
