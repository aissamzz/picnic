"use client";

import { Check, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates/meta";
import { cn } from "@/lib/utils/cn";

const FRAME_W = 220;
const BORDER = 6;
const SCALE = (FRAME_W - BORDER * 2) / 390;

/**
 * The 9 templates as phone previews (the real demo menus at /template-N,
 * shown with the restaurant's name), in a swipeable row of radio cards.
 */
export function TemplateGallery({
  value,
  onChange,
  suggested,
  legend,
  previewName,
}: {
  value: TemplateKey;
  onChange: (key: TemplateKey) => void;
  suggested?: TemplateKey;
  legend: string;
  previewName?: string;
}) {
  const t = useTranslations("onboarding.template");
  const tt = useTranslations("templates");
  const locale = useLocale();
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Start on the selected template.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => {
      const row = rowRef.current;
      const el = row?.querySelector<HTMLElement>('[data-selected="true"]');
      if (!row || !el) return;
      const a = el.getBoundingClientRect();
      const b = row.getBoundingClientRect();
      row.scrollBy({ left: a.left + a.width / 2 - (b.left + b.width / 2) });
    });
    return () => cancelAnimationFrame(id);
    // Only on mount: later picks are already in view.
  }, []);

  const name = previewName?.trim() ? `&nom=${encodeURIComponent(previewName.trim())}` : "";
  return (
    // min-w-0: a fieldset otherwise grows to its content and the page scrolls sideways.
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div ref={rowRef} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:thin]">
        {TEMPLATE_KEYS.map((key, i) => {
          const checked = value === key;
          const href = `/template-${i + 1}?lang=${locale}${name}`;
          return (
            <div key={key} data-selected={checked} className="relative flex shrink-0 snap-center flex-col gap-2" style={{ width: FRAME_W }}>
              <label className="flex cursor-pointer flex-col gap-2 rounded-[30px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-primary">
                <input type="radio" name="template" value={key} checked={checked} onChange={() => onChange(key)} className="sr-only" />
                <span
                  className={cn("relative block overflow-hidden rounded-[28px] bg-ink shadow-md transition-colors", checked ? "border-primary" : "border-ink")}
                  style={{ height: 440, borderWidth: BORDER }}
                >
                  <iframe
                    src={href}
                    title={tt(`${key}.name`)}
                    aria-hidden
                    tabIndex={-1}
                    loading="lazy"
                    className="pointer-events-none absolute top-0 left-0 border-0 bg-white"
                    style={{ width: 390, height: 844, transform: `scale(${SCALE})`, transformOrigin: "top left" }}
                  />
                  {checked && (
                    <span className="absolute end-3 top-3 flex size-8 items-center justify-center rounded-full bg-primary text-white shadow">
                      <Check className="size-5" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="flex flex-col gap-0.5 px-1">
                  <span className="flex items-center gap-2 font-semibold">
                    {tt(`${key}.name`)}
                    <span className="text-xs font-normal text-muted">{t("position", { n: i + 1, total: TEMPLATE_KEYS.length })}</span>
                  </span>
                  <span className="text-sm text-muted">{tt(`${key}.desc`)}</span>
                  {key === suggested && (
                    <Badge tone="accent" className="mt-1 self-start">
                      {t("suggested")}
                    </Badge>
                  )}
                </span>
              </label>
              <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-semibold text-primary">
                <ExternalLink className="size-4" aria-hidden />
                {t("open")}
              </a>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
