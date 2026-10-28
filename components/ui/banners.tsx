"use client";

import { AlertTriangle, Clock, CloudOff, Lock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SubscriptionBannerState = "trial" | "trial_ending" | "grace" | "expired" | "renewal_due";

const styles: Record<SubscriptionBannerState, { box: string; icon: React.ReactNode }> = {
  trial: { box: "bg-info-soft text-info", icon: <Clock /> },
  trial_ending: { box: "bg-warning-soft text-warning", icon: <Clock /> },
  grace: { box: "bg-warning-soft text-warning", icon: <AlertTriangle /> },
  expired: { box: "bg-danger-soft text-danger", icon: <Lock /> },
  renewal_due: { box: "bg-primary-soft text-primary", icon: <RefreshCw /> },
};

/** Subscription status strip on top of the owner app. */
export function SubscriptionBanner({
  state,
  daysLeft,
  href,
  className,
}: {
  state: SubscriptionBannerState;
  daysLeft: number;
  href: string;
  className?: string;
}) {
  const t = useTranslations("subscription.banner");
  const s = styles[state];
  return (
    <div role="status" className={cn("flex items-center gap-3 rounded-md px-3 py-2", s.box, className)}>
      <span className="shrink-0 [&_svg]:size-5" aria-hidden>
        {s.icon}
      </span>
      <p className="flex-1 text-sm font-medium text-ink">{t(`${state}.text`, { days: daysLeft })}</p>
      <Link href={href} className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold underline underline-offset-4">
        {t(`${state}.cta`)}
      </Link>
    </div>
  );
}

/** Shows while the device is offline. */
export function OfflineBanner({
  message,
  forceVisible,
  className,
}: {
  message?: string;
  /** Always render (design showcase, tests). */
  forceVisible?: boolean;
  className?: string;
}) {
  const t = useTranslations("ui");
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline && !forceVisible) return null;
  return (
    <div role="status" className={cn("flex items-center gap-2 bg-ink px-4 py-2 text-sm text-white", className)}>
      <CloudOff className="size-4 shrink-0" aria-hidden />
      {message ?? t("offline")}
    </div>
  );
}
