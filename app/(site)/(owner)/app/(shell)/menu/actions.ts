"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { requireRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { PUBLIC_BUCKET } from "@/lib/storage";
import { toWebp } from "@/lib/storage/images";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { bilingualName } from "@/lib/validation/onboarding";
import { categorySchema, itemSchema } from "@/lib/validation/menu";

/** Owner or staff of the current restaurant (menu editing is open to both). */
async function ctx() {
  const restaurant = await requireRestaurant();
  return { restaurant, supabase: await createClient() };
}

function dbError(error: { code?: string; message?: string } | null) {
  if (error?.code === "42501" || error?.message?.includes("locked")) return fail("errors.locked");
  console.error("menu action", error);
  return fail("errors.generic");
}

function done(slug: string): ActionResult {
  revalidateMenu(slug);
  revalidatePath("/app/menu", "layout");
  return { ok: true };
}

const id = z.guid();

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult<{ id: string }>> {
  const { restaurant, supabase } = await ctx();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  if (v.id) {
    const { error } = await supabase
      .from("categories")
      .update({ name: v.name, is_visible: v.isVisible, schedule_id: v.scheduleId ?? null })
      .eq("id", v.id)
      .eq("restaurant_id", restaurant.id);
    if (error) return dbError(error);
    done(restaurant.slug);
    return { ok: true, data: { id: v.id } };
  }
  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .eq("restaurant_id", restaurant.id)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("categories")
    .insert({ restaurant_id: restaurant.id, name: v.name, is_visible: v.isVisible, schedule_id: v.scheduleId ?? null, position: (last?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error || !data) return dbError(error);
  done(restaurant.slug);
  return { ok: true, data: { id: data.id } };
}

export async function setCategoryVisible(categoryId: string, visible: boolean): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(categoryId).success) return fail("errors.generic");
  const { error } = await supabase.from("categories").update({ is_visible: visible }).eq("id", categoryId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

/** Soft delete; `restoreCategory` is the undo. */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(categoryId).success) return fail("errors.generic");
  const { error } = await supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", categoryId)
    .eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

export async function restoreCategory(categoryId: string): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(categoryId).success) return fail("errors.generic");
  const { error } = await supabase.from("categories").update({ deleted_at: null }).eq("id", categoryId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!z.array(id).max(200).safeParse(ids).success) return fail("errors.generic");
  const { error } = await supabase.rpc("reorder_categories", { p_restaurant_id: restaurant.id, p_ids: ids });
  return error ? dbError(error) : done(restaurant.slug);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function saveItem(input: z.input<typeof itemSchema>): Promise<ActionResult<{ id: string }>> {
  const { restaurant, supabase } = await ctx();
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  // Photos must be this restaurant's uploads.
  if (v.photos.some((p) => !p.startsWith(`${restaurant.id}/items/`))) return fail("errors.forbidden");

  const before = v.id ? (await supabase.from("items").select("photos").eq("id", v.id).eq("restaurant_id", restaurant.id).maybeSingle()).data : null;
  const { data, error } = await supabase.rpc("save_item", {
    p_restaurant_id: restaurant.id,
    p_item: {
      id: v.id ?? null,
      category_id: v.categoryId,
      name: v.name,
      description: v.description,
      base_price: v.basePrice,
      tags: v.tags,
      is_sold_out: v.isSoldOut,
      is_visible: v.isVisible,
      photos: v.photos,
      variants: v.variants,
      extras: v.extras,
    },
  });
  if (error || !data) return dbError(error);
  const removed = (before?.photos ?? []).filter((p) => !v.photos.includes(p));
  if (removed.length) await createServiceClient().storage.from(PUBLIC_BUCKET).remove(removed);
  done(restaurant.slug);
  return { ok: true, data: { id: data } };
}

export async function setSoldOut(itemId: string, soldOut: boolean): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(itemId).success) return fail("errors.generic");
  const { error } = await supabase.from("items").update({ is_sold_out: soldOut }).eq("id", itemId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

export async function setItemVisible(itemId: string, visible: boolean): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(itemId).success) return fail("errors.generic");
  const { error } = await supabase.from("items").update({ is_visible: visible }).eq("id", itemId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

/** Soft delete; `restoreItem` is the undo. Photos stay until a purge job (see TODO). */
export async function deleteItem(itemId: string): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(itemId).success) return fail("errors.generic");
  const { error } = await supabase.from("items").update({ deleted_at: new Date().toISOString() }).eq("id", itemId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

export async function restoreItem(itemId: string): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(itemId).success) return fail("errors.generic");
  const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", itemId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}

export async function reorderItems(ids: string[]): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!z.array(id).max(500).safeParse(ids).success) return fail("errors.generic");
  const { error } = await supabase.rpc("reorder_items", { p_restaurant_id: restaurant.id, p_ids: ids });
  return error ? dbError(error) : done(restaurant.slug);
}

/** Uploads one dish photo (resized to WebP). The path is kept when the item is saved. */
export async function uploadItemPhoto(form: FormData): Promise<ActionResult<{ path: string }>> {
  const { restaurant, supabase } = await ctx();
  const { data: editable } = await supabase.rpc("can_edit_menu", { rid: restaurant.id });
  if (!editable) return fail("errors.locked");
  const file = form.get("photo");
  if (!(file instanceof File)) return fail("errors.imageInvalid");
  let webp: Buffer;
  try {
    webp = await toWebp(file, { width: 1600, height: 1200, fit: "inside" });
  } catch {
    return fail("errors.imageInvalid");
  }
  const path = `${restaurant.id}/items/${randomUUID()}.webp`;
  const { error } = await createServiceClient().storage.from(PUBLIC_BUCKET).upload(path, webp, { contentType: "image/webp" });
  if (error) return dbError(error);
  return { ok: true, data: { path } };
}

// Re-exported for the quick-add sheet on the items page.
export async function quickAddItem(input: { categoryId: string; name: z.input<typeof bilingualName>; price: string }): Promise<ActionResult<{ id: string }>> {
  return saveItem({ categoryId: input.categoryId, name: input.name, description: {}, basePrice: input.price });
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

const priceRows = z
  .array(
    z.object({
      itemId: id,
      basePrice: z.number().int().min(0).max(1_000_000).nullable(),
      variants: z.array(z.object({ id, price: z.number().int().min(0).max(1_000_000) })).max(10),
    }),
  )
  .max(1000);

export async function savePrices(rows: z.input<typeof priceRows>): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  const parsed = priceRows.safeParse(rows);
  if (!parsed.success) return fail("errors.priceInvalid");
  const { error } = await supabase.rpc("set_prices", {
    p_restaurant_id: restaurant.id,
    p_rows: parsed.data.map((r) => ({ item_id: r.itemId, base_price: r.basePrice, variants: r.variants })),
  });
  return error ? dbError(error) : done(restaurant.slug);
}

export async function bumpPrices(input: { delta: number; categoryId: string | null }): Promise<ActionResult<{ count: number }>> {
  const { restaurant, supabase } = await ctx();
  const parsed = z.object({ delta: z.number().int().min(-100_000).max(100_000).refine((d) => d !== 0), categoryId: id.nullable() }).safeParse(input);
  if (!parsed.success) return fail("errors.priceInvalid");
  const { data, error } = await supabase.rpc("bump_prices", {
    p_restaurant_id: restaurant.id,
    p_delta: parsed.data.delta,
    p_category_id: parsed.data.categoryId ?? undefined,
  });
  if (error) return dbError(error);
  done(restaurant.slug);
  return { ok: true, data: { count: data ?? 0 } };
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

const translationRows = z
  .array(
    z.object({
      kind: z.enum(["category", "item", "variant", "extra"]),
      id,
      field: z.enum(["name", "description"]),
      fr: z.string().max(400),
      ar: z.string().max(400),
    }),
  )
  .max(2000);

export async function saveTranslations(rows: z.input<typeof translationRows>): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  const parsed = translationRows.safeParse(rows);
  if (!parsed.success) return fail("errors.generic");
  if (parsed.data.length === 0) return { ok: true };
  const { error } = await supabase.rpc("save_translations", { p_restaurant_id: restaurant.id, p_rows: parsed.data });
  return error ? dbError(error) : done(restaurant.slug);
}

// ---------------------------------------------------------------------------
// Menu schedules (breakfast, lunch menu…)
// ---------------------------------------------------------------------------

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "errors.required");
const scheduleSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "errors.required").max(60),
  starts: time,
  ends: time,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "errors.required"),
  isActive: z.boolean().default(true),
  categoryIds: z.array(id).max(200).default([]),
});

export async function saveSchedule(input: z.input<typeof scheduleSchema>): Promise<ActionResult<{ id: string }>> {
  const { restaurant, supabase } = await ctx();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const row = { restaurant_id: restaurant.id, name: v.name, starts: v.starts, ends: v.ends, weekdays: v.weekdays, is_active: v.isActive };
  const { data, error } = v.id
    ? await supabase.from("menu_schedules").update(row).eq("id", v.id).eq("restaurant_id", restaurant.id).select("id").single()
    : await supabase.from("menu_schedules").insert(row).select("id").single();
  if (error || !data) return dbError(error);
  // Categories follow the checkboxes: attach the checked ones, detach the rest.
  const { error: detachError } = await supabase
    .from("categories")
    .update({ schedule_id: null })
    .eq("restaurant_id", restaurant.id)
    .eq("schedule_id", data.id);
  if (detachError) return dbError(detachError);
  if (v.categoryIds.length) {
    const { error: attachError } = await supabase.from("categories").update({ schedule_id: data.id }).eq("restaurant_id", restaurant.id).in("id", v.categoryIds);
    if (attachError) return dbError(attachError);
  }
  done(restaurant.slug);
  return { ok: true, data: { id: data.id } };
}

export async function deleteSchedule(scheduleId: string): Promise<ActionResult> {
  const { restaurant, supabase } = await ctx();
  if (!id.safeParse(scheduleId).success) return fail("errors.generic");
  const { error } = await supabase.from("menu_schedules").delete().eq("id", scheduleId).eq("restaurant_id", restaurant.id);
  return error ? dbError(error) : done(restaurant.slug);
}
