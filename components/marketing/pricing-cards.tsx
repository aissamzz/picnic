import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import type { PublicPricing } from "@/lib/marketing/pricing";
import { formatPrice } from "@/lib/price";
import { cn } from "@/lib/utils/cn";

/** The three durations, annual highlighted; prices come from the admin settings. */
export async function PricingCards({ pricing, notes }: { pricing: PublicPricing | null; notes?: { annual?: string; semi?: string; monthly?: string } }) {
  const t = await getTranslations("marketing.pricing");
  const locale = (await getLocale()) as Locale;
  if (!pricing) return <p className="text-muted">{t("unavailable")}</p>;
  const price = (n: number) => <bdi dir="ltr">{formatPrice(n, locale)}</bdi>;
  const plans = [
    { key: "annual", label: t("annual"), amount: pricing.price_annual, per: t("perYear"), note: notes?.annual, best: true },
    { key: "semi", label: t("semiannual"), amount: pricing.price_semiannual, per: t("perSix"), note: notes?.semi },
    { key: "monthly", label: t("monthly"), amount: pricing.price_monthly, per: t("perMonth"), note: notes?.monthly },
  ];
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {plans.map((p) => (
        <li
          key={p.key}
          className={cn("relative flex flex-col gap-1 rounded-3xl bg-white p-5", p.best ? "border-2 border-primary shadow-sm" : "border border-line")}
        >
          {p.best && <span className="absolute -top-3 end-4 rounded-lg bg-accent px-2.5 py-1 text-xs font-extrabold text-ink">{t("best")}</span>}
          <span className="text-lg font-extrabold">{p.label}</span>
          <span className="text-3xl font-extrabold tracking-tight">
            {price(p.amount)} <span className="text-sm font-medium text-muted">{p.per}</span>
          </span>
          {p.note && <span className="text-sm text-muted">{p.note}</span>}
        </li>
      ))}
    </ul>
  );
}
