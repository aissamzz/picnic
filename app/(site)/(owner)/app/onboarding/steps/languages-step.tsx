"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TranslateButton } from "@/components/owner/translate-button";
import { Toggle } from "@/components/ui/toggle";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import { saveLanguages } from "../actions";
import { StepFooter } from "./step-footer";
import { StepHeader } from "./step-header";

type Entry = { kind: "category" | "item"; id: string; name: Record<string, string> };
const LOCALES: Locale[] = ["fr", "ar"];

export function LanguagesStep({ enabled: initialEnabled, defaultLocale: initialDefault, entries }: { enabled: Locale[]; defaultLocale: Locale; entries: Entry[] }) {
  const t = useTranslations("onboarding.languages");
  const tr = useTranslations();
  const [enabled, setEnabled] = React.useState<Locale[]>(initialEnabled);
  const [defaultLocale, setDefaultLocale] = React.useState<Locale>(initialDefault);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const missing = entries.flatMap((e) =>
    enabled.filter((l) => !e.name[l]).map((l) => ({ ...e, locale: l, source: e.name[l === "fr" ? "ar" : "fr"] ?? "" })),
  );

  function toggle(l: Locale, on: boolean) {
    setError(null);
    const next = on ? [...new Set([...enabled, l])] : enabled.filter((x) => x !== l);
    if (next.length === 0) return setError("onboarding.languages.atLeastOne");
    setEnabled(LOCALES.filter((x) => next.includes(x)));
    if (!next.includes(defaultLocale)) setDefaultLocale(next[0]);
  }

  return (
    <form
      id="languages-form"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveLanguages({
            enabled,
            defaultLocale,
            translations: missing.map((m) => ({ kind: m.kind, id: m.id, locale: m.locale, value: drafts[`${m.id}:${m.locale}`] ?? "" })),
          });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <StepHeader title={t("title")} subtitle={t("subtitle")} />
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <Card className="divide-y divide-line">
        {LOCALES.map((l) => (
          <label key={l} className="flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="font-medium" lang={l}>
              {t(l)}
            </span>
            <Toggle checked={enabled.includes(l)} onCheckedChange={(on) => toggle(l, on)} />
          </label>
        ))}
      </Card>

      {enabled.length > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">{t("default")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {enabled.map((l) => (
              <label
                key={l}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3",
                  defaultLocale === l ? "border-primary bg-primary-soft" : "border-line bg-surface",
                )}
              >
                <input type="radio" name="default" checked={defaultLocale === l} onChange={() => setDefaultLocale(l)} className="size-5 accent-[var(--primary)]" />
                {t(l)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <section aria-labelledby="missing-title" className="flex flex-col gap-2">
        <h2 id="missing-title" className="font-semibold">
          {t("missingTitle")} <span className="text-muted tabular">({missing.length})</span>
        </h2>
        {missing.length === 0 ? (
          <p className="text-sm text-muted">{t("missingNone")}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{t("missingHint")}</p>
            <TranslateButton
              entries={missing
                .filter((m) => !drafts[`${m.id}:${m.locale}`])
                .map((m) => ({ id: `${m.id}:${m.locale}`, text: m.source, from: m.locale === "fr" ? "ar" : "fr", to: m.locale, kind: m.kind }))}
              onResult={(found) => setDrafts((d) => ({ ...found, ...d }))}
            />
            <Card className="flex flex-col divide-y divide-line">
              {missing.map((m) => {
                const key = `${m.id}:${m.locale}`;
                return (
                  <div key={key} className="flex flex-col gap-1.5 p-3">
                    <label htmlFor={key} className="text-sm text-muted">
                      <bdi>{m.source}</bdi> → {t(m.locale)}
                    </label>
                    <Input
                      id={key}
                      lang={m.locale}
                      dir={m.locale === "ar" ? "rtl" : "ltr"}
                      value={drafts[key] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </section>
      <StepFooter step={5} form="languages-form" pending={pending} />
    </form>
  );
}
