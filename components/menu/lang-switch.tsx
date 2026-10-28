"use client";

import { ChevronDown, Globe } from "lucide-react";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import type { Lang } from "@/lib/menu/types";
import { cx as cn } from "@/lib/utils/cx";

const NAMES: Record<Lang, string> = { fr: "Français", ar: "العربية" };

/**
 * Globe + code + chevron over a native <select> (accessible, native picker
 * on phones). Stores the diner's choice; the middleware serves that language.
 */
export function LangSwitch({
  lang,
  langs,
  label,
  onChange,
  className,
}: {
  lang: Lang;
  langs: Lang[];
  label: string;
  onChange?: (l: Lang) => void;
  className?: string;
}) {
  if (langs.length < 2) return null;
  return (
    <label className={cn("relative inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold uppercase", className)}>
      <Globe className="size-4" aria-hidden />
      <span aria-hidden>{lang}</span>
      <ChevronDown className="size-4" aria-hidden />
      <select
        aria-label={label}
        value={lang}
        className="absolute inset-0 cursor-pointer opacity-0"
        onChange={(e) => {
          const next = e.target.value as Lang;
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
          if (onChange) onChange(next);
          else window.location.reload();
        }}
      >
        {langs.map((l) => (
          <option key={l} value={l} lang={l}>
            {NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
