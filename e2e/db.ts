import { createClient } from "@supabase/supabase-js";

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

/** Supabase client signed in as the E2E super admin (admin RPCs check auth.uid()). */
export async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const phone = (process.env.E2E_ADMIN_PHONE ?? "0555000009").replace(/^0/, "213");
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: `p${phone}@phone.invalid`, password: process.env.E2E_ADMIN_PASSWORD ?? "admin-pass-123" });
  if (error) throw error;
  return client;
}
