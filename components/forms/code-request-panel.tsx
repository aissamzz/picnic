"use client";

import { Clock, PhoneIncoming, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Ltr } from "@/components/ui/ltr";
import { formatMMSS, useCountdown } from "@/hooks/use-countdown";
import { APP_NAME } from "@/lib/config";
import { formatDzPhone } from "@/lib/utils/phone";
import { cn } from "@/lib/utils/cn";

export type CodeStatus = {
  status: "requested" | "issued" | "used" | "expired" | "cancelled";
  secondsLeft: number;
};

type Props = {
  phone: string;
  poll: () => Promise<CodeStatus | null>;
  onRequestAgain: () => void;
  requestAgainPending?: boolean;
  /** Code form, shown while a code is active. */
  children: React.ReactNode;
};

/**
 * Waiting screen for admin-issued codes: "we'll call you" until the admin
 * generates a code, then the code form with a 2-minute countdown.
 */
export function CodeRequestPanel({ phone, poll, onRequestAgain, requestAgainPending, children }: Props) {
  const t = useTranslations("code");
  const [state, setState] = React.useState<CodeStatus | null>(null);
  const pollRef = React.useRef(poll);
  pollRef.current = poll;

  React.useEffect(() => {
    let alive = true;
    let timer: number;
    const tick = async () => {
      const s = await pollRef.current().catch(() => null);
      if (!alive) return;
      if (s) setState((prev) => (prev && prev.status === s.status && Math.abs(prev.secondsLeft - s.secondsLeft) < 4 ? prev : s));
      // Keep polling while something can still change (admin issues or regenerates).
      if (!s || s.status === "requested" || s.status === "issued") timer = window.setTimeout(tick, 3000);
    };
    tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const left = useCountdown(state?.status === "issued" ? state.secondsLeft : null);
  const status = state?.status === "issued" && left === 0 ? "expired" : state?.status;

  if (status === "issued") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-md bg-primary-soft px-4 py-3">
          <div>
            <p className="font-semibold">{t("readyTitle")}</p>
            <p className="text-sm text-muted">{t("readyBody")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end" aria-live="polite">
            <span className="text-xs text-muted">{t("timeLeft")}</span>
            <span className={cn("flex items-center gap-1 text-xl font-bold tabular", left <= 30 ? "text-warning" : "text-primary")} dir="ltr">
              <Clock className="size-4" aria-hidden />
              {formatMMSS(left)}
            </span>
          </div>
        </div>
        {children}
      </div>
    );
  }

  if (status === "expired" || status === "cancelled") {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Clock className="size-8 text-warning" aria-hidden />
        <p className="font-semibold">{t("expiredTitle")}</p>
        <p className="text-sm text-muted">{status === "expired" ? t("expiredBody") : t("cancelledBody")}</p>
        <Button onClick={onRequestAgain} loading={requestAgainPending}>
          <RefreshCw aria-hidden />
          {t("requestAgain")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center" role="status" aria-busy={!state}>
      <span className="relative flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" aria-hidden />
        <PhoneIncoming className="size-7" aria-hidden />
      </span>
      <p className="text-lg font-semibold">{t("waitingTitle")}</p>
      <p className="text-sm text-muted">
        {t.rich("waitingBody", { app: APP_NAME, phone: () => <Ltr className="font-semibold text-ink">{formatDzPhone(phone)}</Ltr> })}
      </p>
    </Card>
  );
}
