"use client";

import { BellRing, Check, Droplet, Receipt, UserRound } from "lucide-react";
import * as React from "react";
import { pingPushDispatch, sessionId } from "@/lib/menu/beacon";
import { cx } from "@/lib/utils/cx";
import { fmt, type MenuLabels } from "../labels";
import { Sheet } from "../sheet";

type Kind = "waiter" | "bill" | "water";
const ICONS: Record<Kind, typeof UserRound> = { waiter: UserRound, bill: Receipt, water: Droplet };

/** Floating "Appeler" on table links: waiter, bill or water, with a cooldown per kind. */
export default function WaiterCall({ restaurantId, tableCode, labels }: { restaurantId: string; tableCode: string; labels: MenuLabels }) {
  const w = labels.waiter;
  const [open, setOpen] = React.useState(false);
  const [until, setUntil] = React.useState<Partial<Record<Kind, number>>>({});
  const [busy, setBusy] = React.useState<Kind | null>(null);
  const [status, setStatus] = React.useState<{ kind: Kind; ok: boolean } | null>(null);
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function call(kind: Kind) {
    setBusy(kind);
    setStatus(null);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${url}/rest/v1/rpc/call_waiter`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_restaurant_id: restaurantId, p_table_code: tableCode, p_kind: kind, p_session_id: sessionId() }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { status: string; retry_after: number };
      setUntil((u) => ({ ...u, [kind]: Date.now() + body.retry_after * 1000 }));
      setStatus({ kind, ok: true });
      if (body.status !== "cooldown") pingPushDispatch();
      navigator.vibrate?.(30);
    } catch {
      setStatus({ kind, ok: false });
    } finally {
      setBusy(null);
    }
  }

  const left = (k: Kind) => Math.max(0, Math.ceil(((until[k] ?? 0) - Date.now()) / 1000));
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed end-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-m-accent px-5 font-bold text-m-on-accent shadow-lg"
      >
        <BellRing className="size-5" aria-hidden />
        {w.button}
      </button>
      <Sheet name="waiter" open={open} onClose={() => setOpen(false)} title={w.title} closeLabel={labels.close}>
        <div className="flex flex-col gap-2 pt-1">
          {(["waiter", "bill", "water"] as const).map((k) => {
            const Icon = ICONS[k];
            const wait = left(k);
            return (
              <button
                key={k}
                type="button"
                disabled={wait > 0 || busy !== null}
                onClick={() => call(k)}
                className={cx("flex min-h-14 items-center gap-3 rounded-m border border-m-line px-4 text-start font-semibold disabled:opacity-60", busy === k && "animate-pulse")}
              >
                <Icon className="size-5 text-m-accent" aria-hidden />
                <span className="flex-1">{w[k]}</span>
                {wait > 0 && (
                  <span className="text-xs font-normal text-m-muted">
                    {fmt(w.cooldown, { time: "" })}
                    <bdi dir="ltr" className="tabular">
                      {mmss(wait)}
                    </bdi>
                  </span>
                )}
              </button>
            );
          })}
          <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium">
            {status?.ok && (
              <span className="inline-flex items-center gap-1.5 text-[#1F7A3D]">
                <Check className="size-4" aria-hidden />
                {w.sent}
              </span>
            )}
            {status && !status.ok && <span className="text-[#b42318]">{w.error}</span>}
          </p>
        </div>
      </Sheet>
    </>
  );
}
