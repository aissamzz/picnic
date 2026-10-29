"use client";

import { ClipboardList, CreditCard, Gauge, KeyRound, LayoutTemplate, Package, PhoneCall, RefreshCw, Settings, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { href: "/admin", key: "overview", icon: Gauge, exact: true },
  { href: "/admin/restaurants", key: "restaurants", icon: Store },
  { href: "/admin/appels", key: "calls", icon: PhoneCall },
  { href: "/admin/paiements", key: "payments", icon: CreditCard },
  { href: "/admin/kits", key: "kits", icon: Package },
  { href: "/admin/renouvellements", key: "renewals", icon: RefreshCw },
  { href: "/admin/codes", key: "codes", icon: KeyRound },
  { href: "/admin/modeles", key: "templates", icon: LayoutTemplate },
  { href: "/admin/journal", key: "audit", icon: ClipboardList },
  { href: "/admin/reglages", key: "settings", icon: Settings },
] as const;

export function AdminNav({ counts }: { counts: { payments: number; calls: number } }) {
  const t = useTranslations("admin");
  const path = usePathname();
  return (
    <nav aria-label={t("title")} className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, key, icon: Icon, ...rest }) => {
        const active = "exact" in rest ? path === href : path.startsWith(href);
        const badge = key === "payments" ? counts.payments : key === "calls" ? counts.calls : 0;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium",
              active ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-sand",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1 whitespace-nowrap">{t(`nav.${key}`)}</span>
            {badge > 0 && <span className="rounded-full bg-danger px-1.5 text-xs font-bold text-white tabular">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
