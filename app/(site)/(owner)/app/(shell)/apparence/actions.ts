"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { PUBLIC_BUCKET } from "@/lib/storage";
import { toWebp } from "@/lib/storage/images";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BRAND_PALETTE, TEMPLATE_KEYS } from "@/lib/templates/meta";

const schema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS),
  primaryColor: z.enum(BRAND_PALETTE).nullable(),
});

export async function saveAppearance(input: z.input<typeof schema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("errors.generic");
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ template_key: parsed.data.templateKey, primary_color: parsed.data.primaryColor })
    .eq("id", r.id);
  if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  revalidateMenu(r.slug);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function uploadCover(form: FormData): Promise<ActionResult<{ path: string }>> {
  const r = await requireOwnerRestaurant();
  const file = form.get("cover");
  if (!(file instanceof File)) return fail("errors.imageInvalid");
  let webp: Buffer;
  try {
    webp = await toWebp(file, { width: 1600, height: 900 });
  } catch {
    return fail("errors.imageInvalid");
  }
  const path = `${r.id}/cover-${Date.now()}.webp`;
  const service = createServiceClient();
  const { error: upErr } = await service.storage.from(PUBLIC_BUCKET).upload(path, webp, { contentType: "image/webp" });
  if (upErr) return fail("errors.generic");
  const supabase = await createClient();
  const { data: before } = await supabase.from("restaurants").select("cover_path").eq("id", r.id).single();
  const { error } = await supabase.from("restaurants").update({ cover_path: path }).eq("id", r.id);
  if (error) {
    await service.storage.from(PUBLIC_BUCKET).remove([path]);
    return fail("errors.locked");
  }
  if (before?.cover_path) await service.storage.from(PUBLIC_BUCKET).remove([before.cover_path]);
  revalidateMenu(r.slug);
  return { ok: true, data: { path } };
}

export async function removeCover(): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { data: before } = await supabase.from("restaurants").select("cover_path").eq("id", r.id).single();
  const { error } = await supabase.from("restaurants").update({ cover_path: null }).eq("id", r.id);
  if (error) return fail("errors.locked");
  if (before?.cover_path) await createServiceClient().storage.from(PUBLIC_BUCKET).remove([before.cover_path]);
  revalidateMenu(r.slug);
  return { ok: true };
}
