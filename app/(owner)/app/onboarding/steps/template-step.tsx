"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { RestaurantType } from "@/lib/dz/restaurant-types";
import { defaultTemplateFor, TEMPLATE_KEYS, TEMPLATE_SWATCH, type TemplateKey } from "@/lib/templates/meta";
import { cn } from "@/lib/utils/cn";
import { saveTemplate } from "../actions";
import { StepFooter } from "./step-footer";
import { StepHeader } from "./step-header";

export function TemplateStep({ current, type }: { current: string; type: RestaurantType }) {
  const t = useTranslations("onboarding.template");
  const tt = useTranslations("templates");
  const [value, setValue] = React.useState<TemplateKey>(current as TemplateKey);
  const [pending, start] = React.useTransition();
  const suggested = defaultTemplateFor(type);

  return (
    <form
      id="template-form"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTemplate({ templateKey: value });
        });
      }}
    >
      <StepHeader title={t("title")} subtitle={t("subtitle")} />
      <fieldset>
        <legend className="sr-only">{t("title")}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TEMPLATE_KEYS.map((key) => {
            const s = TEMPLATE_SWATCH[key];
            const checked = value === key;
            return (
              <label
                key={key}
                className={cn(
                  "relative flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 bg-surface transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                  checked ? "border-primary" : "border-line hover:border-muted/50",
                )}
              >
                <input type="radio" name="template" value={key} checked={checked} onChange={() => setValue(key)} className="sr-only" />
                <div className="flex h-28 flex-col gap-1.5 p-3" style={{ background: s.bg, color: s.fg }} aria-hidden>
                  <span className={cn("text-base leading-tight font-bold", s.serif && "font-serif")}>{tt(`${key}.name`)}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-6", s.round ? "rounded-full" : "rounded-sm")} style={{ background: s.accent }} />
                    <span className="h-1.5 flex-1 rounded-full opacity-60" style={{ background: s.fg }} />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-6", s.round ? "rounded-full" : "rounded-sm")} style={{ background: s.accent, opacity: 0.7 }} />
                    <span className="h-1.5 w-2/3 rounded-full opacity-40" style={{ background: s.fg }} />
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-3">
                  <span className="font-semibold">{tt(`${key}.name`)}</span>
                  <span className="text-xs text-muted">{tt(`${key}.desc`)}</span>
                  {key === suggested && (
                    <Badge tone="accent" className="mt-1 self-start">
                      {t("suggested")}
                    </Badge>
                  )}
                </div>
                {checked && (
                  <span className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="size-4" aria-hidden />
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
      <StepFooter step={2} form="template-form" pending={pending} />
    </form>
  );
}
