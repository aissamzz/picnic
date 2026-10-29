"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export type WaiterCall = {
  id: string;
  kind: "waiter" | "bill" | "water";
  status: "open" | "handled";
  created_at: string;
  handled_at: string | null;
  table: { code: string; label: string | null } | null;
};

const POLL_MS = 5_000;
const realtime = process.env.NEXT_PUBLIC_REALTIME !== "off";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Today's waiter calls for a restaurant. Realtime pushes a refetch when it is
 * available; polling always runs as a fallback (slower while realtime is up).
 */
export function useWaiterCalls(restaurantId: string, onNew?: (call: WaiterCall) => void) {
  const [calls, setCalls] = React.useState<WaiterCall[] | null>(null);
  const seen = React.useRef<Set<string> | null>(null);
  const onNewRef = React.useRef(onNew);
  onNewRef.current = onNew;

  const refresh = React.useCallback(async () => {
    const { data } = await createClient()
      .from("waiter_calls")
      .select("id, kind, status, created_at, handled_at, table:tables(code, label)")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", startOfToday())
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data) return;
    const rows = data as unknown as WaiterCall[];
    if (seen.current) for (const c of rows) if (c.status === "open" && !seen.current.has(c.id)) onNewRef.current?.(c);
    seen.current = new Set(rows.map((c) => c.id));
    setCalls(rows);
  }, [restaurantId]);

  React.useEffect(() => {
    void refresh();
    const supabase = createClient();
    const channel = realtime
      ? supabase
          .channel(`calls:${restaurantId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurantId}` }, () => void refresh())
          .subscribe()
      : null;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, realtime ? POLL_MS * 6 : POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [restaurantId, refresh]);

  return { calls, refresh, setCalls };
}
