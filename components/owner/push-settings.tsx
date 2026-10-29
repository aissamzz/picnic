"use client";

import { BellOff, BellRing, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { removePushSubscription, savePushSubscription, sendPushTestAction } from "@/lib/actions/push";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "===".slice((base64url.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker, if the app registered one (production builds). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return navigator.serviceWorker.ready;
}

function detect(): State | null {
  if (!VAPID || typeof window === "undefined") return "unsupported";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  // iPhone: push exists only in the app added to the Home Screen.
  if (ios && !standalone) return "install";
  if (!("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

/**
 * Waiter calls, orders (and, for owners, billing notices) on this phone, even
 * with the app closed. Each phone and each person subscribes on its own.
 * `prompt`: compact card for the home screen, hidden once enabled or unsupported.
 */
export function PushSettings({ prompt }: { prompt?: boolean }) {
  const t = useTranslations("owner.push");
  const tr = useTranslations();
  const locale = useLocale();
  const [state, setState] = React.useState<State>("loading");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const early = detect();
    if (early) return setState(early);
    let alive = true;
    registration().then(async (reg) => {
      if (!alive) return;
      if (!reg) return setState("unsupported");
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      if (!reg) return setState("unsupported");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
      const r = await savePushSubscription(sub.toJSON(), locale, navigator.userAgent);
      if (!r.ok) {
        await sub.unsubscribe();
        return toast(tr(r.error as never));
      }
      setState("on");
      toast(t("enabled"));
    } catch {
      toast(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await (await registration())?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const r = await sendPushTestAction();
    setBusy(false);
    toast(r.ok ? (r.data.sent > 0 ? t("testSent") : t("testNone")) : tr(r.error as never));
  }

  if (prompt) {
    if (state !== "off" && state !== "install") return null;
    return (
      <Card className="flex items-start gap-3 p-4">
        <BellRing className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        <div className="flex flex-1 flex-col gap-2">
          <p className="font-semibold">{t("title")}</p>
          <p className="text-sm text-muted">{state === "install" ? t("iosInstall") : t("body")}</p>
          {state === "off" && (
            <Button size="sm" className="self-start" loading={busy} onClick={enable}>
              {t("enable")}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        {state === "on" ? <BellRing className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden /> : <BellOff className="mt-0.5 size-6 shrink-0 text-muted" aria-hidden />}
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{t("title")}</p>
          <p role="status" className="text-sm text-muted">
            {state === "loading"
              ? tr("ui.loading")
              : state === "on"
                ? t("on")
                : state === "off"
                  ? t("body")
                  : state === "install"
                    ? t("iosInstall")
                    : state === "denied"
                      ? t("denied")
                      : t("unsupported")}
          </p>
        </div>
      </div>
      {state === "off" && (
        <Button className="self-start" loading={busy} onClick={enable}>
          <BellRing aria-hidden />
          {t("enable")}
        </Button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy} onClick={test}>
            <Send aria-hidden />
            {t("test")}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={disable}>
            {t("disable")}
          </Button>
        </div>
      )}
    </Card>
  );
}
