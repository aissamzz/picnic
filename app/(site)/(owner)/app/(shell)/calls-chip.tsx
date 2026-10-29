"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useWaiterCalls } from "@/components/owner/use-waiter-calls";

/** Open waiter calls, visible from every owner screen. */
export function CallsChip({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("owner.calls");
  const pathname = usePathname();
  const { calls } = useWaiterCalls(restaurantId, () => navigator.vibrate?.(150));
  const open = calls?.filter((c) => c.status === "open").length ?? 0;
  if (!open || pathname === "/app/appels") return null;
  return (
    <Link href="/app/appels" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-white">
      <BellRing className="size-4" aria-hidden />
      {t("chip", { count: open })}
    </Link>
  );
}
