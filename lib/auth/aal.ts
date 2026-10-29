import type { SupabaseClient } from "@supabase/supabase-js";

/** Assurance level of the current session ("aal1" password, "aal2" + TOTP), from a verified JWT. */
export async function sessionAal(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims as { aal?: string } | undefined)?.aal ?? null;
}
