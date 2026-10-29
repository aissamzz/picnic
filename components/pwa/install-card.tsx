"use client";

import { Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISSED = "liinky:install-dismissed";

/** Owner home: install offer (Android/desktop prompt, or the iPhone how-to). Hidden once installed or dismissed. */
export function InstallCard() {
  const t = useTranslations("pwa.install");
  const [event, setEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = React.useState(false);
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {}
    if (standalone || dismissed) return;
    setHidden(false);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
  };

  if (hidden || (!event && !ios)) return null;
  return (
    <Card className="flex items-start gap-3 p-4">
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{t("title")}</p>
        <p className="text-sm text-muted">{ios ? t("ios") : t("body")}</p>
        {event && (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await event.prompt();
                setEvent(null);
                dismiss();
              }}
            >
              <Download aria-hidden />
              {t("cta")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("later")}
            </Button>
          </div>
        )}
      </div>
      {!event && (
        <button type="button" onClick={dismiss} aria-label={t("later")} className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-line">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </Card>
  );
}
