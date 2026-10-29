import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AuditFilters = { action?: string; restaurant?: string; from?: string; to?: string };

/** Audit entries with actor and restaurant names, newest first. */
export async function auditEntries(f: AuditFilters, limit: number) {
  const supabase = await createClient();
  let q = supabase
    .from("audit_log")
    .select("id, action, created_at, payload, actor_id, restaurant:restaurants(id, name, slug)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (f.action) q = q.ilike("action", `${f.action.replace(/[%_]/g, "")}%`);
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) q = q.gte("created_at", `${f.from}T00:00:00+01:00`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) q = q.lte("created_at", `${f.to}T23:59:59+01:00`);
  if (f.restaurant) {
    const { data: ids } = await supabase.from("restaurants").select("id").or(`name.ilike.%${f.restaurant.replace(/[%_,()]/g, "")}%,slug.ilike.%${f.restaurant.replace(/[%_,()]/g, "")}%`).limit(50);
    q = q.in("restaurant_id", (ids ?? []).map((r) => r.id).concat("00000000-0000-0000-0000-000000000000"));
  }
  const { data } = await q;
  const actorIds = [...new Set((data ?? []).flatMap((e) => (e.actor_id ? [e.actor_id] : [])))];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", actorIds) : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.full_name || a.phone || a.id.slice(0, 8)]));
  return (data ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    created_at: e.created_at,
    payload: e.payload as Record<string, unknown>,
    actor: e.actor_id ? (names.get(e.actor_id) ?? e.actor_id.slice(0, 8)) : null,
    restaurant: e.restaurant as unknown as { id: string; name: string; slug: string } | null,
  }));
}
