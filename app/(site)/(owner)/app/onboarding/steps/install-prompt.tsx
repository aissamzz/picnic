"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Shown only when the browser offers PWA installation (service worker lands in phase 9). */
export function InstallPrompt({ label, hint }: { label: string; hint: string }) {
  const [event, setEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (!event) return null;
  return (
    <Card className="flex items-center gap-3 p-4">
      <p className="flex-1 text-sm text-muted">{hint}</p>
      <Button
        variant="soft"
        onClick={async () => {
          await event.prompt();
          setEvent(null);
        }}
      >
        <Download aria-hidden />
        {label}
      </Button>
    </Card>
  );
}
