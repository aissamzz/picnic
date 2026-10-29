"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { createClient } from "@/lib/supabase/server";
import { normalizeDzPhone } from "@/lib/utils/phone";

const money = z.coerce.number<string | number>().int().min(0, "errors.priceInvalid").max(100_000, "errors.priceInvalid");

const schema = z
  .object({
    enabled: z.boolean(),
    whatsapp: z.string().trim().transform((v, ctx) => {
      if (!v) return null;
      const e164 = normalizeDzPhone(v);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "errors.phoneInvalid" });
        return z.NEVER;
      }
      return e164;
    }),
    delivery: z.boolean(),
    takeaway: z.boolean(),
    zones: z.array(z.object({ id: z.guid().optional(), name: z.string().trim().min(1, "errors.required").max(40), fee: money })).max(30),
    minOrder: money,
    eta: z.string().trim().max(30),
  })
  .refine((v) => !v.enabled || v.whatsapp, { path: ["whatsapp"], message: "owner.orders.whatsappRequired" })
  .refine((v) => v.delivery || v.takeaway, { path: ["delivery"], message: "owner.orders.oneMode" });

export async function saveOrderSettings(input: z.input<typeof schema>): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const supabase = await createClient();
  const locked = (code?: string) => fail(code === "42501" ? "errors.locked" : "errors.generic");

  const { error } = await supabase
    .from("restaurants")
    .update({
      orders_enabled: v.enabled,
      whatsapp_order_phone: v.whatsapp,
      delivery_enabled: v.delivery,
      takeaway_enabled: v.takeaway,
      min_order: v.minOrder,
      eta_label: v.eta || null,
    })
    .eq("id", r.id);
  if (error) return locked(error.code);

  // Zones: delete the removed ones, update the kept ones, insert the new ones.
  const { data: existing } = await supabase.from("delivery_zones").select("id").eq("restaurant_id", r.id);
  const keep = new Set(v.zones.flatMap((z) => (z.id ? [z.id] : [])));
  const removed = (existing ?? []).map((z) => z.id).filter((id) => !keep.has(id));
  if (removed.length) {
    const { error: e } = await supabase.from("delivery_zones").delete().in("id", removed);
    if (e) return locked(e.code);
  }
  for (const [i, z] of v.zones.entries()) {
    const row = { restaurant_id: r.id, name: z.name, fee: z.fee, position: i + 1 };
    const { error: e } = z.id ? await supabase.from("delivery_zones").update(row).eq("id", z.id).eq("restaurant_id", r.id) : await supabase.from("delivery_zones").insert(row);
    if (e) return locked(e.code);
  }

  revalidateMenu(r.slug);
  revalidatePath("/app", "layout");
  return { ok: true };
}
