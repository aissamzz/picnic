"use client";

import { useTranslations } from "next-intl";
import { ImportReview } from "@/components/owner/import/import-review";
import type { ImportDraft } from "@/lib/ai/draft";
import { skipStep } from "../actions";
import { StepHeader } from "./step-header";

export function ReviewStep({ importId, draft }: { importId: string; draft: ImportDraft }) {
  const t = useTranslations("import.review");
  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={t("title")} subtitle={t("subtitle")} />
      <ImportReview importId={importId} initial={draft} restartHref="/app/onboarding/3" onApplied={() => skipStep(4)} />
    </div>
  );
}
