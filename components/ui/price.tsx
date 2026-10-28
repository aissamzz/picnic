import { useLocale } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils/cn";

/** Price in DA, always isolated as LTR so it reads correctly in Arabic text. */
export function Price({
  amount,
  hideCurrency,
  className,
}: {
  amount: number;
  hideCurrency?: boolean;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  return (
    <bdi dir="ltr" className={cn("tabular whitespace-nowrap", className)}>
      {formatPrice(amount, locale, { hideCurrency })}
    </bdi>
  );
}
