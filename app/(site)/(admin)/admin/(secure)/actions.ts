"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireSuperAdmin } from "@/lib/auth/session";
import { VIEW_AS_COOKIE } from "@/lib/config";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const id = z.guid();

/** RPC errors -> message keys the admin screens know. */
function rpcFail(error: { message: string; code?: string } | null, fallback = "errors.generic") {
  if (!error) return null;
  const known: Record<string, string> = {
    invalid_settings: "admin.settings.invalid",
    invalid_slug: "admin.templates.errors.invalid_slug",
    slug_in_use: "admin.templates.errors.slug_in_use",
    bad_stage: "admin.kits.invalidMove",
  };
  return fail(known[error.message] ?? fallback);
}

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------
export async function extendTrial(restaurantId: string, days: number): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!id.safeParse(restaurantId).success || !Number.isInteger(days) || days < 1 || days > 90) return fail("errors.generic");
  const { error } = await (await createClient()).rpc("admin_extend_trial", { p_restaurant_id: restaurantId, p_days: days });
  refresh(`/admin/restaurants/${restaurantId}`);
  return rpcFail(error) ?? { ok: true };
}

export async function activateUntil(restaurantId: string, until: string, plan: "monthly" | "semiannual" | "annual"): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!id.safeParse(restaurantId).success || !/^\d{4}-\d{2}-\d{2}$/.test(until) || !["monthly", "semiannual", "annual"].includes(plan)) return fail("errors.generic");
  const { error } = await (await createClient()).rpc("admin_activate_until", { p_restaurant_id: restaurantId, p_until: until, p_plan: plan });
  refresh(`/admin/restaurants/${restaurantId}`);
  return rpcFail(error) ?? { ok: true };
}

export async function setSuspended(restaurantId: string, suspended: boolean, reason?: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!id.safeParse(restaurantId).success || (suspended && !reason?.trim())) return fail("errors.required");
  const { error } = await (await createClient()).rpc("admin_set_suspended", { p_restaurant_id: restaurantId, p_suspended: suspended, p_reason: reason?.trim() });
  refresh(`/admin/restaurants/${restaurantId}`);
  return rpcFail(error) ?? { ok: true };
}

export async function addNote(restaurantId: string, body: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!id.safeParse(restaurantId).success || !body.trim()) return fail("errors.required");
  const { error } = await (await createClient()).rpc("admin_add_note", { p_restaurant_id: restaurantId, p_body: body.slice(0, 2000) });
  refresh(`/admin/restaurants/${restaurantId}`);
  return rpcFail(error) ?? { ok: true };
}

const outcome = z.enum(["interested", "call_back", "not_interested", "no_answer"]);
export async function logCall(restaurantId: string, input: { outcome: string; note?: string; nextAt?: string }): Promise<ActionResult> {
  await requireSuperAdmin();
  const o = outcome.safeParse(input.outcome);
  if (!id.safeParse(restaurantId).success || !o.success) return fail("errors.generic");
  const next = input.nextAt && /^\d{4}-\d{2}-\d{2}$/.test(input.nextAt) ? `${input.nextAt}T09:00:00+01:00` : undefined;
  const { error } = await (await createClient()).rpc("admin_log_call", { p_restaurant_id: restaurantId, p_outcome: o.data, p_note: input.note?.slice(0, 1000), p_next_action_at: next });
  refresh(`/admin/restaurants/${restaurantId}`, "/admin/appels", "/admin/renouvellements");
  return rpcFail(error) ?? { ok: true };
}

/** Opens the owner dashboard read-only (audited). */
export async function viewAs(restaurantId: string) {
  await requireSuperAdmin();
  if (!id.safeParse(restaurantId).success) return;
  const { error } = await (await createClient()).rpc("admin_log_impersonation", { p_restaurant_id: restaurantId });
  if (error) return;
  (await cookies()).set(VIEW_AS_COOKIE, restaurantId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 });
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
export async function approvePayment(paymentId: string): Promise<ActionResult<{ paidUntil: string }>> {
  await requireSuperAdmin();
  if (!id.safeParse(paymentId).success) return fail("errors.generic");
  const { data, error } = await (await createClient()).rpc("approve_payment", { p_payment_id: paymentId });
  refresh("/admin/paiements");
  if (error || !data) return rpcFail(error) ?? fail("errors.generic");
  return { ok: true, data: { paidUntil: data } };
}

export async function rejectPayment(paymentId: string, reason: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!id.safeParse(paymentId).success || !reason.trim()) return fail("errors.required");
  const { error } = await (await createClient()).rpc("reject_payment", { p_payment_id: paymentId, p_reason: reason.trim().slice(0, 200) });
  refresh("/admin/paiements");
  return rpcFail(error) ?? { ok: true };
}

// ---------------------------------------------------------------------------
// Kits
// ---------------------------------------------------------------------------
export async function uploadMockup(form: FormData): Promise<ActionResult> {
  await requireSuperAdmin();
  const kitId = String(form.get("kitId") ?? "");
  const file = form.get("file");
  if (!id.safeParse(kitId).success || !(file instanceof File) || file.size === 0 || file.size > 20 * 1024 * 1024) return fail("errors.generic");
  const types: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const ext = types[file.type];
  if (!ext) return fail("errors.generic");
  const supabase = await createClient();
  const { data: kit } = await supabase.from("kit_orders").select("restaurant_id").eq("id", kitId).single();
  if (!kit) return fail("errors.generic");
  const path = `${kit.restaurant_id}/${kitId}/mockup-${randomUUID().slice(0, 8)}.${ext}`;
  const { error: up } = await createServiceClient().storage.from("kit").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (up) return fail("errors.generic");
  const { error } = await supabase.rpc("kit_set_mockup", { p_kit_id: kitId, p_path: path });
  refresh("/admin/kits");
  return rpcFail(error) ?? { ok: true };
}

const stage = z.enum(["printed", "shipped", "delivered", "paid"]);
export async function advanceKit(kitId: string, to: string, tracking?: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const s = stage.safeParse(to);
  if (!id.safeParse(kitId).success || !s.success) return fail("admin.kits.invalidMove");
  const { error } = await (await createClient()).rpc("kit_advance", { p_kit_id: kitId, p_stage: s.data, p_tracking: tracking?.trim() || undefined });
  refresh("/admin/kits");
  return rpcFail(error) ?? { ok: true };
}

// ---------------------------------------------------------------------------
// Settings, templates, slugs
// ---------------------------------------------------------------------------
const int = (min: number, max: number) => z.coerce.number<string | number>().int().min(min).max(max);
const settingsSchema = z.object({
  price_monthly: int(1, 1_000_000),
  price_semiannual: int(1, 1_000_000),
  price_annual: int(1, 1_000_000),
  kit_price: int(0, 1_000_000),
  trial_days: int(1, 60),
  grace_days: int(0, 60),
  baridimob_rip: z.string().trim().max(40),
  ccp_number: z.string().trim().max(20),
  ccp_key: z.string().trim().max(4),
  ccp_holder: z.string().trim().max(80),
  code_ttl_seconds: int(30, 900),
  code_max_attempts: int(1, 10),
  code_requests_per_hour: int(1, 20),
  waiter_call_cooldown_sec: int(10, 3600),
  block_after_reports: int(1, 20),
  ai_imports_per_trial: int(0, 100),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(input: SettingsInput): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), "admin.settings.invalid"]));
    return fail("admin.settings.invalid", fieldErrors);
  }
  const { error } = await (await createClient()).rpc("admin_update_settings", { p: parsed.data });
  refresh("/admin/reglages");
  return rpcFail(error) ?? { ok: true };
}

export async function setTemplateActive(key: string, active: boolean): Promise<ActionResult> {
  await requireSuperAdmin();
  const { error } = await (await createClient()).rpc("admin_set_template_active", { p_key: key, p_active: active });
  refresh("/admin/modeles");
  return rpcFail(error) ?? { ok: true };
}

export async function reserveSlug(slug: string, reserved: boolean): Promise<ActionResult> {
  await requireSuperAdmin();
  const { error } = await (await createClient()).rpc("admin_reserve_slug", { p_slug: slug, p_reserved: reserved });
  refresh("/admin/modeles");
  return rpcFail(error) ?? { ok: true };
}
