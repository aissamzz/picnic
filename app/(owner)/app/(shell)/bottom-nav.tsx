"use client";

import { BarChart3, Home, MoreHorizontal, Share2, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

const items = [
  { href: "/app", key: "home", icon: Home, exact: true },
  { href: "/app/menu", key: "menu", icon: UtensilsCrossed },
  { href: "/app/partager", key: "share", icon: Share2 },
  { href: "/app/stats", key: "stats", icon: BarChart3 },
  { href: "/app/plus", key: "more", icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const t = useTranslations("nav");
  const path = usePathname();
  return (
    <nav aria-label={t("main")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {items.map(({ href, key, icon: Icon, ...rest }) => {
          const active = "exact" in rest ? path === href : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-6" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
