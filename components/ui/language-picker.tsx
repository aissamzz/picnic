"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

const names: Record<Locale, string> = { fr: "Français", ar: "العربية" };

/** Globe + current code + chevron. Stores the choice in a cookie. */
export function LanguagePicker({ className, onChange }: { className?: string; onChange?: (l: Locale) => void }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    onChange?.(next);
    start(() => router.refresh());
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold uppercase hover:bg-ink/5",
          pending && "opacity-60",
          className,
        )}
        aria-label={t("language")}
      >
        <Globe className="size-5" aria-hidden />
        {locale}
        <ChevronDown className="size-4" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-md border border-line bg-surface p-1 shadow-sheet"
        >
          {locales.map((l) => (
            <DropdownMenu.Item
              key={l}
              lang={l}
              onSelect={() => pick(l)}
              className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sand"
            >
              {names[l]}
              {l === locale && <Check className="size-4 text-primary" aria-hidden />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
