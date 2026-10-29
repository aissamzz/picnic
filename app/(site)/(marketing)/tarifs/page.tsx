import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { getPublicPricing } from "@/lib/marketing/pricing";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.pricingPage"))("metaTitle") };
}

export default async function PricingPage() {
  const t = await getTranslations("marketing.pricingPage");
  const pricing = await getPublicPricing();
  const how = t.raw("how") as { title: string; body: string }[];
  const included = t.raw("included") as string[];
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-lg text-muted">{t("body")}</p>
      </div>
      <PricingCards pricing={pricing} notes={{ annual: t("annualNote"), semi: t("semiNote"), monthly: t("monthlyNote") }} />
      <Link href="/inscription" className="inline-flex min-h-13 items-center justify-center self-start rounded-2xl bg-primary px-6 font-bold text-white hover:bg-primary-hover">
        {t("start")}
      </Link>

      <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{t("howTitle")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {how.map((h) => (
          <li key={h.title} className="rounded-2xl bg-white p-4">
            <p className="font-extrabold">{h.title}</p>
            <p className="text-sm leading-relaxed text-muted">{h.body}</p>
          </li>
        ))}
      </ul>
      <p className="rounded-2xl bg-primary-soft p-4 text-primary-ink">{t("noOnline")}</p>

      <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{t("includedTitle")}</h2>
      <ul className="divide-y divide-line rounded-2xl bg-white px-4">
        {included.map((i) => (
          <li key={i} className="flex min-h-12 items-center gap-3">
            <Check className="size-5 shrink-0 text-primary" aria-hidden />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
