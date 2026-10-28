"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";
import { saveTables } from "../actions";
import { StepFooter } from "./step-footer";
import { StepHeader } from "./step-header";

const MAX = 100;

export function TablesStep({ initialCount, restaurantLocale }: { initialCount: number; restaurantLocale: Locale }) {
  const t = useTranslations("onboarding.tables");
  const [count, setCount] = React.useState(initialCount || 10);
  const [pending, start] = React.useTransition();
  // Table labels are stored in the restaurant's default language.
  const labelTemplate = restaurantLocale === "ar" ? "طاولة {n}" : "Table {n}";

  return (
    <form
      id="tables-form"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTables({ count }, labelTemplate);
        });
      }}
    >
      <StepHeader title={t("title")} subtitle={t("subtitle")} />
      <Card className="flex flex-col items-center gap-4 p-6">
        <label htmlFor="table-count" className="font-medium">
          {t("count")}
        </label>
        <div className="flex items-center gap-4">
          <Button type="button" variant="secondary" size="icon" aria-label={t("decrease")} onClick={() => setCount((c) => Math.max(0, c - 1))} disabled={count === 0}>
            <Minus />
          </Button>
          <input
            id="table-count"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX}
            value={count}
            onChange={(e) => setCount(Math.max(0, Math.min(MAX, Number(e.target.value) || 0)))}
            className="w-24 rounded-md border border-line bg-surface py-2 text-center text-3xl font-bold tabular"
            dir="ltr"
          />
          <Button type="button" variant="secondary" size="icon" aria-label={t("increase")} onClick={() => setCount((c) => Math.min(MAX, c + 1))}>
            <Plus />
          </Button>
        </div>
        {count === 0 ? (
          <p className="text-sm text-muted">{t("none")}</p>
        ) : (
          <ul className="flex max-w-full flex-wrap justify-center gap-1.5" aria-hidden>
            {Array.from({ length: Math.min(count, 24) }, (_, i) => (
              <li key={i} className="rounded-sm bg-sand px-2 py-1 text-xs font-medium tabular">
                {labelTemplate.replace("{n}", String(i + 1))}
              </li>
            ))}
            {count > 24 && <li className="px-2 py-1 text-xs text-muted">…</li>}
          </ul>
        )}
        <p className="text-center text-sm text-muted">{t("hint")}</p>
      </Card>
      <StepFooter step={6} form="tables-form" pending={pending} skippable />
    </form>
  );
}
