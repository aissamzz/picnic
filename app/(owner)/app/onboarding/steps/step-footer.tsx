"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { skipStep } from "../actions";

/** Sticky bottom actions: primary submit + optional skip. */
export function StepFooter({ step, form, pending, skippable }: { step: number; form?: string; pending?: boolean; skippable?: boolean }) {
  const t = useTranslations("onboarding");
  const [skipping, start] = useTransition();
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t border-line bg-sand/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
      {skippable && (
        <Button type="button" variant="ghost" size="lg" loading={skipping} onClick={() => start(() => skipStep(step))}>
          {t("skip")}
        </Button>
      )}
      <Button type="submit" form={form} size="lg" className="flex-1" loading={pending}>
        {t("next")}
      </Button>
    </div>
  );
}
