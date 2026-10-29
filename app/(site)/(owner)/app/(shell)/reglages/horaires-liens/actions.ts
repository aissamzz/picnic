"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { createClient } from "@/lib/supabase/server";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "owner.hoursLinks.timeInvalid");
const slot = z
  .object({ weekday: z.number().int().min(0).max(6), opens: time, closes: time })
  .refine((s) => s.opens !== s.closes, { path: ["closes"], message: "owner.hoursLinks.timeInvalid" });
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "owner.hoursLinks.urlInvalid");
const handle = z.string().trim().max(200);

const schema = z.object({
  hours: z.array(slot).max(21),
  exceptions: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "errors.required"), note: z.string().trim().max(80) }))
    .max(60)
    .refine((list) => new Set(list.map((e) => e.date)).size === list.length, "owner.hoursLinks.duplicateDate"),
  links: z.object({ instagram: handle, facebook: handle, tiktok: handle, maps_url: url, google_review_url: url }),
});
export type HoursLinksInput = z.input<typeof schema>;

export async function saveHoursAndLinks(input: HoursLinksInput): Promise<ActionResult> {
  const r = await requireOwnerRestaurant();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const v = parsed.data;
  const { error } = await (await createClient()).rpc("save_hours_and_links", {
    p_restaurant_id: r.id,
    p_hours: v.hours,
    p_exceptions: v.exceptions.map((e) => ({ ...e, closed: true })),
    p_links: v.links,
  });
  if (error) return fail(error.code === "42501" ? "errors.locked" : "errors.generic");
  revalidateMenu(r.slug);
  revalidatePath("/app/reglages/horaires-liens");
  return { ok: true };
}
