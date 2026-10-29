"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { suggestTranslations } from "@/lib/actions/ai-import";

export type TranslateEntry = { id: string; text: string; from: "fr" | "ar"; to: "fr" | "ar"; kind: "category" | "item" | "description" };

/**
 * Asks the AI for the missing translations and hands them back as suggestions;
 * nothing is saved until the owner saves the form.
 */
export function TranslateButton({ entries, onResult, disabled }: { entries: TranslateEntry[]; onResult: (t: Record<string, string>) => void; disabled?: boolean }) {
  const t = useTranslations("import.translate");
  const tr = useTranslations();
  const [pending, start] = React.useTransition();
  const todo = entries.filter((e) => e.text.trim());
  return (
    <Button
      type="button"
      variant="soft"
      disabled={disabled || todo.length === 0}
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await suggestTranslations(todo.slice(0, 300));
          if (!r.ok) return void toast(tr(r.error as never));
          const n = Object.keys(r.data.translations).length;
          onResult(r.data.translations);
          toast(n ? t("done", { count: n }) : t("none"));
        })
      }
    >
      <Languages aria-hidden />
      {pending ? t("running") : t("button")}
    </Button>
  );
}
