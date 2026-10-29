"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeDzPhone } from "@/lib/utils/phone";

const known: Record<string, string> = {
  phone_invalid: "errors.phoneInvalid",
  already_member: "owner.team.alreadyMember",
  team_full: "owner.team.full",
  cannot_remove_owner: "errors.forbidden",
};

export async function inviteStaff(phone: string): Promise<ActionResult<{ token: string }>> {
  const r = await requireOwnerRestaurant();
  const e164 = normalizeDzPhone(phone);
  if (!e164) return fail("errors.phoneInvalid", { phone: "errors.phoneInvalid" });
  const { data, error } = await (await createClient()).rpc("invite_staff", { p_restaurant_id: r.id, p_phone: e164 });
  revalidatePath("/app/equipe");
  if (error || !data) return fail(known[error?.message ?? ""] ?? (error?.code === "42501" ? "errors.locked" : "errors.generic"));
  return { ok: true, data: { token: data } };
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  await requireOwnerRestaurant();
  if (!z.guid().safeParse(memberId).success) return fail("errors.generic");
  const { error } = await (await createClient()).rpc("remove_member", { p_member_id: memberId });
  revalidatePath("/app/equipe");
  return error ? fail(known[error.message] ?? "errors.generic") : { ok: true };
}
