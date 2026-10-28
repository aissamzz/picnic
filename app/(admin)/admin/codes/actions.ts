"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { phoneSchema } from "@/lib/validation/auth";

export type CodeRequestRow = Database["public"]["Functions"]["admin_code_requests"]["Returns"][number];
export type IssuedCode = { requestId: string; code: string; secondsLeft: number };

function secondsUntil(iso: string) {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

export async function listCodeRequests(): Promise<CodeRequestRow[]> {
  await requireSuperAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_code_requests");
  return data ?? [];
}

export async function issueCode(requestId: string): Promise<ActionResult<IssuedCode>> {
  await requireSuperAdmin();
  if (!z.guid().safeParse(requestId).success) return fail("errors.generic");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_issue_code", { p_request_id: requestId });
  const row = data?.[0];
  if (error || !row) return fail("errors.generic");
  return { ok: true, data: { requestId, code: row.code, secondsLeft: secondsUntil(row.expires_at) } };
}

export async function createCode(input: { phone: string; purpose: "verify_phone" | "reset_password" }): Promise<ActionResult<IssuedCode>> {
  await requireSuperAdmin();
  const phone = phoneSchema.safeParse(input.phone);
  if (!phone.success) return fail("errors.phoneInvalid", { phone: "errors.phoneInvalid" });
  if (input.purpose !== "verify_phone" && input.purpose !== "reset_password") return fail("errors.generic");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_code", { p_phone: phone.data, p_purpose: input.purpose });
  if (error) return fail(error.message.includes("no_account") ? "errors.noAccount" : "errors.generic", error.message.includes("no_account") ? { phone: "errors.noAccount" } : undefined);
  const row = data?.[0];
  if (!row) return fail("errors.generic");
  return { ok: true, data: { requestId: row.request_id, code: row.code, secondsLeft: secondsUntil(row.expires_at) } };
}

export async function cancelCode(requestId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  if (!z.guid().safeParse(requestId).success) return fail("errors.generic");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_code", { p_request_id: requestId });
  return error ? fail("errors.generic") : { ok: true };
}
