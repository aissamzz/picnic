"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/actions/result";
import { phoneToAuthEmail } from "@/lib/auth/phone-identity";
import { clientIp, isIpLimited } from "@/lib/http/client-ip";
import { resolveLocale } from "@/lib/i18n/request";
import { rateLimit, rateLimitExceeded } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { loginSchema, phoneSchema, resetSchema, signupSchema } from "@/lib/validation/auth";

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signUp(input: z.input<typeof signupSchema>, next?: string): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const { fullName, phone, password } = parsed.data;

  const ip = await clientIp();
  if (isIpLimited(ip) && !(await rateLimit(`signup:${ip}`, 30, 3600))) return fail("errors.rateLimited");

  const service = createServiceClient();
  const { data: existing } = await service.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (existing) return fail("errors.phoneTaken", { phone: "errors.phoneTaken" });

  const email = phoneToAuthEmail(phone);
  const { error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phone, full_name: fullName, locale: await resolveLocale() },
  });
  if (error) {
    if (error.code === "email_exists" || error.status === 422) return fail("errors.phoneTaken", { phone: "errors.phoneTaken" });
    if (error.code === "weak_password") return fail("errors.passwordTooShort", { password: "errors.passwordTooShort" });
    console.error("signUp createUser", error);
    return fail("errors.generic");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error("signUp signIn", signInError);
    return fail("errors.generic");
  }
  redirect(next ? safeNext(next) : "/app/onboarding/1");
}

export async function signIn(input: z.input<typeof loginSchema>, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const { phone, password } = parsed.data;

  const ip = await clientIp();
  // Only failed attempts count: 10 per phone and 100 per IP every 15 minutes.
  if ((await rateLimitExceeded(`login-fail:${phone}`, 10, 900)) || (isIpLimited(ip) && (await rateLimitExceeded(`login-fail-ip:${ip}`, 100, 900)))) {
    return fail("errors.rateLimited");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: phoneToAuthEmail(phone), password });
  if (error) {
    await rateLimit(`login-fail:${phone}`, 10, 900);
    if (isIpLimited(ip)) await rateLimit(`login-fail-ip:${ip}`, 100, 900);
    return fail("errors.invalidCredentials");
  }
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/connexion");
}

// ---------------------------------------------------------------------------
// Forgot password: request -> admin calls and issues a code -> new password.
// ---------------------------------------------------------------------------

export async function requestPasswordReset(input: { phone: string }): Promise<ActionResult<{ requestId: string; phone: string }>> {
  const parsed = phoneSchema.safeParse(input.phone);
  if (!parsed.success) return fail("errors.phoneInvalid", { phone: parsed.error.issues[0].message });
  const ip = await clientIp();
  if (isIpLimited(ip) && !(await rateLimit(`reset-ip:${ip}`, 20, 3600))) return fail("errors.rateLimited");

  const { data, error } = await createServiceClient().rpc("request_password_reset", { p_phone: parsed.data });
  if (error) return fail(error.message.includes("rate_limited") ? "errors.rateLimited" : "errors.generic");
  if (!data) return fail("errors.noAccount", { phone: "errors.noAccount" });
  return { ok: true, data: { requestId: data, phone: parsed.data } };
}

export type CodeRequestStatus = {
  status: "requested" | "issued" | "used" | "expired" | "cancelled";
  secondsLeft: number;
};

export async function getResetStatus(requestId: string): Promise<CodeRequestStatus | null> {
  if (!z.guid().safeParse(requestId).success) return null;
  const { data } = await createServiceClient().rpc("get_code_request", { p_request_id: requestId });
  const row = data?.[0];
  if (!row || row.purpose !== "reset_password") return null;
  return { status: row.status, secondsLeft: row.seconds_left };
}

const codeResultError: Record<string, string> = {
  invalid: "errors.codeInvalid",
  expired: "errors.codeExpired",
  too_many: "errors.codeTooMany",
  no_code: "errors.codeNone",
};

export async function resetPassword(input: z.input<typeof resetSchema>): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return fail("errors.generic", zodFieldErrors(parsed.error.issues));
  const { requestId, code, password } = parsed.data;

  const service = createServiceClient();
  const { data, error } = await service.rpc("consume_reset_code", { p_request_id: requestId, p_code: code });
  const row = data?.[0];
  if (error || !row) return fail("errors.generic");
  if (row.result !== "ok" || !row.user_id) {
    const key = codeResultError[row.result] ?? "errors.generic";
    return fail(key, { code: key });
  }

  const { data: updated, error: updateError } = await service.auth.admin.updateUserById(row.user_id, { password });
  if (updateError || !updated.user.email) {
    console.error("resetPassword update", updateError);
    return fail("errors.generic");
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: updated.user.email, password });
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function acceptInvite(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    if (error.message.includes("already_member")) return fail("errors.alreadyMember");
    if (error.message.includes("invite_invalid")) return fail("errors.inviteInvalid");
    return fail("errors.generic");
  }
  redirect("/app");
}
