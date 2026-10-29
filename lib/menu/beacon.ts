import type { MenuMode } from "./types";

/** Maps ?src= values from shared links to traffic sources. */
const SOURCES: Record<string, string> = {
  ig: "instagram",
  instagram: "instagram",
  fb: "facebook",
  facebook: "facebook",
  tt: "tiktok",
  tiktok: "tiktok",
  poster: "poster",
  affiche: "poster",
  flyer: "poster",
  wa: "whatsapp",
  whatsapp: "whatsapp",
};

export function trafficSource(mode: MenuMode, src: string | null): string {
  if (mode === "table") return "table";
  return SOURCES[(src ?? "").toLowerCase()] ?? "direct";
}

/** Per-tab anonymous session id (analytics, order and call rate limits). */
export function sessionId(): string {
  try {
    let id = sessionStorage.getItem("liinky:sid");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem("liinky:sid", id);
    }
    return id;
  } catch {
    return "nostorage-" + Math.random().toString(16).slice(2, 14);
  }
}

/** Fire-and-forget analytics event (public RPC, anon key, survives page unload). */
export function logMenuEvent(e: {
  restaurantId: string;
  kind: "view_table" | "view_order" | "item_view";
  source: string;
  tableCode?: string | null;
  itemId?: string;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  fetch(`${url}/rest/v1/rpc/log_menu_event`, {
    method: "POST",
    keepalive: true,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_restaurant_id: e.restaurantId,
      p_kind: e.kind,
      p_session_id: sessionId(),
      p_source: e.source,
      p_table_code: e.tableCode ?? null,
      p_item_id: e.itemId ?? null,
    }),
  }).catch(() => {});
}
