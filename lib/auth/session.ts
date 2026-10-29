import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { VIEW_AS_COOKIE } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { sessionAal } from "@/lib/auth/aal";

export type MyRestaurant = {
  id: string;
  slug: string;
  name: string;
  role: "owner" | "staff";
  status: "trial" | "active" | "grace" | "expired" | "suspended" | "paused";
  trial_ends_at: string;
  /** Owners only (billing columns); null for staff and before the first payment. */
  paid_until: string | null;
  /** Super admin viewing this restaurant read-only (see VIEW_AS_COOKIE). */
  viewAs?: boolean;
  onboarding_step: number;
  went_live_at: string | null;
  default_locale: string;
  enabled_locales: string[];
  template_key: string;
};

/** Signed-in user + profile, once per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, locale, is_super_admin, phone_verified_at")
    .eq("id", user.id)
    .single();
  return profile ? { user, profile } : null;
});

export async function requireSession(next = "/app") {
  const session = await getSession();
  if (!session) redirect(`/connexion?next=${encodeURIComponent(next)}`);
  return session;
}

const RESTAURANT_COLUMNS = "id, slug, name, status, trial_ends_at, onboarding_step, went_live_at, default_locale, enabled_locales, template_key, deleted_at";

/** The restaurant the user works on (owners first). Null before onboarding step 1. */
export const getMyRestaurant = cache(async (): Promise<MyRestaurant | null> => {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();

  // Super admin "view as owner" (read-only; the middleware blocks every write under /app).
  const viewAs = session.profile.is_super_admin ? (await cookies()).get(VIEW_AS_COOKIE)?.value : undefined;
  if (viewAs) {
    const { data: r } = await supabase.from("restaurants").select(RESTAURANT_COLUMNS).eq("id", viewAs).maybeSingle();
    const { data: billing } = await supabase.from("restaurant_billing").select("paid_until").eq("id", viewAs).maybeSingle();
    if (r && !r.deleted_at) return { ...r, role: "owner", paid_until: billing?.paid_until ?? null, viewAs: true } as MyRestaurant;
  }

  const { data: memberships } = await supabase
    .from("restaurant_members")
    .select("role, restaurant_id")
    .eq("user_id", session.user.id)
    .eq("invite_status", "accepted");
  if (!memberships?.length) return null;
  const sorted = [...memberships].sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1));
  for (const m of sorted) {
    // Request guard: apply the subscription state machine before reading.
    await supabase.rpc("sync_subscription", { p_restaurant_id: m.restaurant_id });
    const { data: r } = await supabase
      .from("restaurants")
      .select(RESTAURANT_COLUMNS)
      .eq("id", m.restaurant_id)
      .maybeSingle();
    if (r && !r.deleted_at) {
      const { data: billing } =
        m.role === "owner" ? await supabase.from("restaurant_billing").select("paid_until").eq("id", r.id).maybeSingle() : { data: null };
      return { ...r, role: m.role, paid_until: billing?.paid_until ?? null } as MyRestaurant;
    }
  }
  return null;
});

export async function requireRestaurant(): Promise<MyRestaurant> {
  await requireSession();
  const r = await getMyRestaurant();
  if (!r) redirect("/app/onboarding/1");
  return r;
}

export async function requireOwnerRestaurant(): Promise<MyRestaurant> {
  const r = await requireRestaurant();
  if (r.role !== "owner") redirect("/app");
  return r;
}

/** Super admin with a two-factor (TOTP) session. The database enforces aal2 too. */
export async function requireSuperAdmin() {
  const session = await requireSession("/admin");
  if (!session.profile.is_super_admin) redirect("/app");
  if ((await sessionAal(await createClient())) !== "aal2") redirect("/admin/mfa");
  return session;
}
