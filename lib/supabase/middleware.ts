import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { Database } from "./types";
import { hasSupabaseEnv, supabaseEnv } from "./env";

/** Refreshes the auth session cookie and returns the current user (or null). */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  if (!hasSupabaseEnv()) return { user: null, supabase: null };
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
