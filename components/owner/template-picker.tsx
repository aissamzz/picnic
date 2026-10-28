"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { TEMPLATE_KEYS, TEMPLATE_SWATCH, type TemplateKey } from "@/lib/templates/meta";
import { cn } from "@/lib/utils/cn";

/** Radio grid of the 9 menu templates with mini swatches. */
export function TemplatePicker({
  value,
  onChange,
  suggested,
  legend,
  compact,
}: {
  value: TemplateKey;
  onChange: (key: TemplateKey) => void;
  suggested?: TemplateKey;
  legend: string;
  compact?: boolean;
}) {
  const t = useTranslations("onboarding.template");
  const tt = useTranslations("templates");
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className={cn("grid gap-3", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}>
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
              <input type="radio" name="template" value={key} checked={checked} onChange={() => onChange(key)} className="sr-only" />
              <div className={cn("flex flex-col gap-1.5 p-3", compact ? "h-16" : "h-28")} style={{ background: s.bg, color: s.fg }} aria-hidden>
                <span className={cn("leading-tight font-bold", compact ? "text-xs" : "text-base", s.serif && "font-serif")}>{tt(`${key}.name`)}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn(compact ? "size-4" : "size-6", s.round ? "rounded-full" : "rounded-sm")} style={{ background: s.accent }} />
                  <span className="h-1.5 flex-1 rounded-full opacity-60" style={{ background: s.fg }} />
                </span>
                {!compact && (
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-6", s.round ? "rounded-full" : "rounded-sm")} style={{ background: s.accent, opacity: 0.7 }} />
                    <span className="h-1.5 w-2/3 rounded-full opacity-40" style={{ background: s.fg }} />
                  </span>
                )}
              </div>
              <div className={cn("flex flex-col gap-0.5", compact ? "p-2" : "p-3")}>
                <span className={cn("font-semibold", compact && "text-xs")}>{tt(`${key}.name`)}</span>
                {!compact && <span className="text-xs text-muted">{tt(`${key}.desc`)}</span>}
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
  );
}
