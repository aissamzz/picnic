import { createClient } from "@supabase/supabase-js";
import { totp } from "./totp";

/** Service-role client for seeding test data (bypasses RLS). */
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (.env.local)");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** A throwaway restaurant with one category and item. Returns its slug and a cleanup function. */
export async function tempRestaurant(fields: Record<string, unknown> = {}) {
  const slug = `e2e-${Math.random().toString(36).slice(2, 8)}`;
  const client = db();
  const { data: r, error } = await client
    .from("restaurants")
    .insert({ slug, name: `E2E ${slug}`, template_key: "cafe", status: "trial", ...fields })
    .select("id")
    .single();
  if (error) throw error;
  const { data: c } = await client.from("categories").insert({ restaurant_id: r.id, name: { fr: "Boissons", ar: "مشروبات" } }).select("id").single();
  await client.from("items").insert({ restaurant_id: r.id, category_id: c!.id, name: { fr: "Thé", ar: "شاي" }, base_price: 100 });
  await client.from("tables").insert({ restaurant_id: r.id, code: "T1", label: "Table 1" });
  return { id: r.id as string, slug, cleanup: () => client.from("restaurants").delete().eq("id", r.id) };
}

const ADMIN_EMAIL = `p${(process.env.E2E_ADMIN_PHONE ?? "0555000009").replace(/^0/, "213")}@phone.invalid`;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin-pass-123";
let adminSecret: Promise<string> | undefined;

/**
 * TOTP secret of the E2E super admin. Once per test run, existing factors are
 * removed and a fresh one is enrolled (admin pages and RPCs require aal2).
 */
export function adminTotpSecret(): Promise<string> {
  adminSecret ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data: s, error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    if (error) throw error;
    const { data: list } = await db().auth.admin.mfa.listFactors({ userId: s.user!.id });
    for (const f of list?.factors ?? []) await db().auth.admin.mfa.deleteFactor({ id: f.id, userId: s.user!.id });
    const { data: e, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `e2e-${Date.now()}` });
    if (enrollError) throw enrollError;
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: e.id, code: totp(e.totp.secret) });
    if (verifyError) throw verifyError;
    return e.totp.secret;
  })();
  return adminSecret;
}

/** Supabase client signed in as the E2E super admin with a two-factor (aal2) session. */
export async function adminClient() {
  const secret = await adminTotpSecret();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error) throw error;
  const { data: factors } = await client.auth.mfa.listFactors();
  const factor = factors!.totp.find((f) => f.status === "verified")!;
  const { error: mfaError } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(secret) });
  if (mfaError) throw mfaError;
  return client;
}
