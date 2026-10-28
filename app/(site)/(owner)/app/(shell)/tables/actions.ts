"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { createClient } from "@/lib/supabase/server";

const tableSchema = z.object({
  id: z.guid(),
  label: z.string().trim().min(1, "errors.required").max(40),
  zone: z.string().trim().max(40).optional().default(""),
  isActive: z.boolean(),
});

function changed(slug: string): ActionResult {
  revalidateMenu(slug);
  revalidatePath("/app/tables");
  return { ok: true };
}

const err = (code?: string) => fail(code === "42501" ? "errors.locked" : "errors.generic");

export async function addTable(labelTemplate: string): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tables").select("code, position").eq("restaurant_id", r.id);
  // Next free T{n}.
  const used = new Set((existing ?? []).map((t) => t.code.toUpperCase()));
  let n = 1;
  while (used.has(`T${n}`)) n++;
  const position = Math.max(0, ...(existing ?? []).map((t) => t.position)) + 1;
  const { error } = await supabase
    .from("tables")
    .insert({ restaurant_id: r.id, code: `T${n}`, label: labelTemplate.replace("{n}", String(n)).slice(0, 40), position });
  return error ? err(error.code) : changed(r.slug);
}

export async function updateTable(input: z.input<typeof tableSchema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = tableSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase
    .from("tables")
    .update({ label: parsed.data.label, zone: parsed.data.zone || null, is_active: parsed.data.isActive })
    .eq("id", parsed.data.id)
    .eq("restaurant_id", r.id);
  return error ? err(error.code) : changed(r.slug);
}

export async function deleteTable(tableId: string): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  if (!z.guid().safeParse(tableId).success) return fail("errors.generic");
  const supabase = await createClient();
  const { error } = await supabase.from("tables").delete().eq("id", tableId).eq("restaurant_id", r.id);
  return error ? err(error.code) : changed(r.slug);
}
