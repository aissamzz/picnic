import { Lock } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Shown on editing screens when the subscription no longer allows changes. */
export async function LockedNotice() {
  const t = await getTranslations("menuAdmin");
  const tb = await getTranslations("subscription.banner.expired");
  return (
    <div role="status" className="flex items-start gap-3 rounded-md bg-danger-soft px-4 py-3">
      <Lock className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">{t("lockedTitle")}</p>
        <p className="text-sm text-muted">{t("lockedBody")}</p>
      </div>
      <Link href="/app/plus" className="min-h-11 shrink-0 self-center text-sm font-semibold text-danger underline underline-offset-4">
        {tb("cta")}
      </Link>
    </div>
  );
}

export function canEditMenu(status: string): boolean {
  return status !== "expired" && status !== "suspended";
}
