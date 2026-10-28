"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CodeStatus } from "@/components/forms/code-request-panel";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { codeSchema, newPasswordSchema } from "@/lib/validation/auth";

export async function updateName(input: { fullName: string }): Promise<ActionResult> {
  const { user } = await requireSession();
  const parsed = z.object({ fullName: z.string().trim().min(2, "errors.required").max(80) }).safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return fail("errors.generic");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function changePassword(input: z.input<typeof newPasswordSchema>): Promise<ActionResult> {
  await requireSession();
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.code === "same_password" ? "errors.generic" : "errors.generic");
  return { ok: true };
}

export async function requestVerification(): Promise<ActionResult<{ requestId: string }>> {
  await requireSession();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_phone_verification");
  if (error || !data) {
    if (error?.message.includes("already_verified")) return fail("errors.alreadyVerified");
    if (error?.message.includes("rate_limited")) return fail("errors.rateLimited");
    return fail("errors.generic");
  }
  return { ok: true, data: { requestId: data } };
}

export async function getVerificationStatus(requestId: string): Promise<CodeStatus | null> {
  if (!z.guid().safeParse(requestId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_code_request", { p_request_id: requestId });
  const row = data?.[0];
  return row ? { status: row.status, secondsLeft: row.seconds_left } : null;
}

const resultError: Record<string, string> = {
  invalid: "errors.codeInvalid",
  expired: "errors.codeExpired",
  too_many: "errors.codeTooMany",
  no_code: "errors.codeNone",
};

export async function verifyPhone(input: { code: string }): Promise<ActionResult> {
  await requireSession();
  const parsed = codeSchema.safeParse(input.code);
  if (!parsed.success) return fail("errors.codeFormat", { code: "errors.codeFormat" });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_phone_code", { p_code: parsed.data });
  if (error) return fail("errors.generic");
  if (data !== "ok") {
    const key = resultError[data] ?? "errors.generic";
    return fail(key, { code: key });
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}
