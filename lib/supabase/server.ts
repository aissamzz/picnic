import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";
import { supabaseEnv } from "./env";

/** Per-request client acting as the signed-in user (RLS applies). */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS: server-only, use for jobs and admin RPCs. */
export function createServiceClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Cookie-less anon client, safe inside ISR / cached public menu rendering. */
export function createAnonClient() {
  const { url, anonKey } = supabaseEnv();
  return createSupabaseClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
