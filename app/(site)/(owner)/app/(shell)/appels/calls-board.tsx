"use client";

import { Bell, BellOff, Check, Droplets, HandPlatter, Receipt } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useWaiterCalls, type WaiterCall } from "@/components/owner/use-waiter-calls";
import { useReadOnly } from "@/components/owner/read-only";
import { createClient } from "@/lib/supabase/client";

const ICONS = { waiter: HandPlatter, bill: Receipt, water: Droplets } as const;
const SOUND_KEY = "liinky:calls-sound";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.5);
    o.onended = () => void ctx.close();
  } catch {
    // No audio: vibration and the list still work.
  }
}

export function CallsBoard({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("owner.calls");
  const readOnly = useReadOnly();
  const tr = useTranslations();
  const format = useFormatter();
  const now = useNow({ updateInterval: 15_000 });
  const [sound, setSound] = React.useState(false);
  React.useEffect(() => {
    try {
      setSound(localStorage.getItem(SOUND_KEY) === "1");
    } catch {}
  }, []);
  const soundRef = React.useRef(sound);
  soundRef.current = sound;

  const { calls, refresh, setCalls } = useWaiterCalls(restaurantId, () => {
    if (soundRef.current) beep();
    navigator.vibrate?.([120, 60, 120]);
  });

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {}
    if (next) beep(); // also unlocks audio after a user gesture
  };

  const handle = async (call: WaiterCall) => {
    setCalls((s) => s && s.map((c) => (c.id === call.id ? { ...c, status: "handled", handled_at: new Date().toISOString() } : c)));
    const { error } = await createClient().rpc("handle_waiter_call", { p_call_id: call.id });
    if (error) toast(tr("errors.generic"));
    void refresh();
  };

  const tableName = (c: WaiterCall) => (c.table ? c.table.label || c.table.code : t("noTable"));
  const ago = (iso: string) => {
    const s = (now.getTime() - new Date(iso).getTime()) / 1000;
    return s < 45 ? t("justNow") : format.relativeTime(new Date(iso), now);
  };
  const open = (calls ?? []).filter((c) => c.status === "open").reverse();
  const handled = (calls ?? []).filter((c) => c.status === "handled");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-success">
          <span className="size-2 animate-pulse rounded-full bg-success" aria-hidden />
          {t("live")}
        </span>
        <Button variant={sound ? "secondary" : "ghost"} size="sm" aria-pressed={sound} onClick={toggleSound}>
          {sound ? <Bell aria-hidden /> : <BellOff aria-hidden />}
          {sound ? t("soundOn") : t("soundOff")}
        </Button>
      </div>

      <section aria-live="polite" className="flex flex-col gap-2">
        {calls && open.length === 0 && <Card className="p-6 text-center text-muted">{t("empty")}</Card>}
        {open.map((c) => {
          const Icon = ICONS[c.kind];
          return (
            <Card key={c.id} className="flex items-center gap-3 border-primary/40 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{tableName(c)}</p>
                <p className="text-sm text-muted">
                  {t(`kinds.${c.kind}`)} · {ago(c.created_at)}
                </p>
              </div>
              <Button disabled={readOnly} onClick={() => void handle(c)} aria-label={`${t("going")} · ${tableName(c)}`}>
                <Check aria-hidden />
                {t("going")}
              </Button>
            </Card>
          );
        })}
      </section>

      {handled.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">{t("handledTitle")}</h2>
          <Card className="divide-y divide-line">
            {handled.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{tableName(c)}</span> · {t(`kinds.${c.kind}`)}
                </span>
                <span className="shrink-0 text-muted tabular">
                  {t("handledBy", { time: format.dateTime(new Date(c.handled_at ?? c.created_at), { hour: "2-digit", minute: "2-digit" }) })}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
