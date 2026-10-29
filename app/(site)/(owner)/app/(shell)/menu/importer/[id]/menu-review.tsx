"use client";

import { useRouter } from "next/navigation";
import { ImportReview } from "@/components/owner/import/import-review";
import type { ImportDraft } from "@/lib/ai/draft";

export function MenuReview({ importId, draft }: { importId: string; draft: ImportDraft }) {
  const router = useRouter();
  return (
    <ImportReview
      importId={importId}
      initial={draft}
      restartHref="/app/menu/importer"
      withBottomNav
      onApplied={() => {
        router.push("/app/menu");
        router.refresh();
      }}
    />
  );
}
