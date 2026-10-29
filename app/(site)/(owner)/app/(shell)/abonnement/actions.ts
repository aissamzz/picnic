"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant, requireRestaurant } from "@/lib/auth/session";
import { normalizeDzPhone } from "@/lib/utils/phone";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const MAX_RECEIPT = 10 * 1024 * 1024;
const IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Uploads the receipt privately and declares the payment (amount and reference set by the database). */
export async function submitPayment(form: FormData): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const plan = z.enum(["monthly", "semiannual", "annual"]).safeParse(form.get("plan"));
  const method = z.enum(["baridimob", "ccp", "cash"]).safeParse(form.get("method"));
  const file = form.get("receipt");
  if (!plan.success || !method.success) return fail("billing.errors.generic");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_RECEIPT || !(IMAGE.has(file.type) || file.type === "application/pdf")) {
    return fail("billing.errors.receipt");
  }

  let body: Buffer;
  let ext: "jpg" | "pdf";
  try {
    const raw = Buffer.from(await file.arrayBuffer());
    if (file.type === "application/pdf") {
      if (raw.subarray(0, 4).toString() !== "%PDF") return fail("billing.errors.receipt");
      [body, ext] = [raw, "pdf"];
    } else {
      body = await sharp(raw, { failOn: "error" }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
      ext = "jpg";
    }
  } catch {
    return fail("billing.errors.receipt");
  }

  const path = `${r.id}/${randomUUID()}.${ext}`;
  const service = createServiceClient();
  const { error: upErr } = await service.storage.from("receipts").upload(path, body, { contentType: ext === "pdf" ? "application/pdf" : "image/jpeg" });
  if (upErr) return fail("billing.errors.generic");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment", { p_restaurant_id: r.id, p_plan: plan.data, p_method: method.data, p_receipt_path: path });
  if (error) {
    await service.storage.from("receipts").remove([path]);
    return fail(error.message === "pending_exists" ? "billing.errors.pending_exists" : "billing.errors.generic");
  }
  revalidatePath("/app/abonnement");
  return { ok: true };
}

const kitSchema = z.object({
  stands: z.coerce.number<string | number>().int().min(1).max(50),
  posters: z.coerce.number<string | number>().int().min(0).max(20),
  wilayaCode: z.coerce.number<string | number>().int().min(1).max(69),
  commune: z.string().trim().max(60),
  address: z.string().trim().min(3).max(200),
  phone: z.string().trim(),
});

export async function orderKit(input: z.input<typeof kitSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = kitSchema.safeParse(input);
  const phone = parsed.success ? normalizeDzPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return fail(parsed.success ? "kit.errors.invalid_address" : "kit.errors.invalid_counts");
  const v = parsed.data;
  const { error } = await (await createClient()).rpc("order_kit", {
    p_restaurant_id: r.id,
    p_stands: v.stands,
    p_posters: v.posters,
    p_wilaya_code: v.wilayaCode,
    p_commune: v.commune,
    p_address: v.address,
    p_phone: phone,
  });
  if (error) return fail(["kit_open", "invalid_address", "invalid_counts"].includes(error.message) ? `kit.errors.${error.message}` : "kit.errors.generic");
  revalidatePath("/app/kit");
  return { ok: true };
}

export async function reviewMockup(kitId: string, approve: boolean, feedback?: string): Promise<ActionResult> {
  await requireOwnerRestaurant();
  if (!z.guid().safeParse(kitId).success) return fail("errors.generic");
  if (!approve && !feedback?.trim()) return fail("errors.required");
  const { error } = await (await createClient()).rpc("review_kit_mockup", { p_kit_id: kitId, p_approve: approve, p_feedback: feedback?.trim().slice(0, 500) });
  if (error) return fail("errors.generic");
  revalidatePath("/app/kit");
  return { ok: true };
}

export async function markNotificationsRead(): Promise<void> {
  const r = await requireRestaurant();
  await (await createClient()).rpc("mark_notifications_read", { p_restaurant_id: r.id });
  revalidatePath("/app", "layout");
}
