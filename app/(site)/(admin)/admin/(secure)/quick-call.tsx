"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "@/components/ui/toast";
import { logCall } from "./actions";

/** One-tap outcome logging after a phone call. */
export function QuickCall({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("admin.detail");
  const tr = useTranslations();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={t("logCall")}>
      {(["interested", "call_back", "not_interested", "no_answer"] as const).map((o) => (
        <button
          key={o}
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await logCall(restaurantId, { outcome: o });
              toast(r.ok ? t("done") : tr(r.error as never));
            })
          }
          className="min-h-9 rounded-full border border-line bg-surface px-3 text-xs font-semibold hover:bg-sand disabled:opacity-50"
        >
          {t(`outcomes.${o}`)}
        </button>
      ))}
    </div>
  );
}
