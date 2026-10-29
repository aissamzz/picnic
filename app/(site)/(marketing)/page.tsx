import { BarChart3, BellRing, MessageCircle, WifiOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Faq } from "@/components/marketing/faq";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { TemplateCards } from "@/components/marketing/template-cards";
import type { Locale } from "@/lib/i18n/config";
import { getPublicPricing } from "@/lib/marketing/pricing";
import { formatPrice } from "@/lib/price";

const FEATURE_ICONS = [MessageCircle, BellRing, WifiOff, BarChart3];

export default async function Home() {
  const t = await getTranslations("marketing");
  const locale = (await getLocale()) as Locale;
  const pricing = await getPublicPricing();
  const steps = t.raw("steps.items") as { title: string; body: string }[];
  const features = t.raw("features.items") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-8 pb-14 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-14">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-[#A3123F]">
            {t("hero.badge", { days: pricing?.trial_days ?? 14 })}
          </span>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance md:text-6xl">{t("hero.title")}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted">{t("hero.body")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-white hover:bg-primary-hover">
              {t("hero.cta")}
            </Link>
            <Link href="/demo" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-line bg-white px-6 text-base font-bold hover:bg-cream">
              {t("hero.demo")}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute inset-x-6 top-10 bottom-0 rounded-[40px] bg-primary" aria-hidden />
          <div className="relative mx-auto w-[260px] overflow-hidden rounded-[36px] border-[7px] border-ink bg-ink shadow-xl">
            <Image
              src={`/marketing/hero-menu-${locale}.webp`}
              alt={t("hero.imageAlt")}
              width={520}
              height={1013}
              priority
              sizes="260px"
              className="h-auto w-full rounded-[28px]"
            />
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
          <h2 className="text-3xl font-extrabold tracking-tight">{t("steps.title")}</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-lg font-extrabold text-[#A3123F]">{i + 1}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-bold">{s.title}</span>
                  <span className="leading-relaxed text-muted">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">{t("templates.title")}</h2>
            <p className="text-muted">{t("templates.body")}</p>
          </div>
          <Link href="/demo" className="inline-flex min-h-11 items-center font-bold text-primary underline-offset-4 hover:underline">
            {t("templates.all")}
          </Link>
        </div>
        <TemplateCards />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="mb-6 text-3xl font-extrabold tracking-tight">{t("features.title")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <li key={f.title} className="flex flex-col gap-2 rounded-3xl bg-white p-5">
                <Icon className="size-6 text-primary" aria-hidden />
                <span className="font-bold">{f.title}</span>
                <span className="text-sm leading-relaxed text-muted">{f.body}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-extrabold tracking-wider text-accent">{t("kit.eyebrow")}</span>
            <h2 className="text-3xl font-extrabold tracking-tight">{t("kit.title")}</h2>
            <p className="leading-relaxed text-white/80">{t("kit.body")}</p>
            {pricing && (
              <p className="font-bold">
                {t("kit.price", { price: formatPrice(pricing.kit_price + pricing.price_annual, locale) })}
              </p>
            )}
          </div>
          <div className="flex h-44 items-center justify-center gap-4 rounded-3xl bg-white/5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-32 w-20 flex-col items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10">
                <Image src="/brand/liinky-symbol-white.svg" alt="" width={32} height={32} />
                <span className="text-xs font-bold text-white/80">T{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-14">
        <h2 className="text-3xl font-extrabold tracking-tight">{t("pricing.title")}</h2>
        <PricingCards pricing={pricing} />
        <p className="text-sm text-muted">{t("pricing.offline")}</p>
        <Link href="/tarifs" className="inline-flex min-h-11 items-center self-start font-bold text-primary underline-offset-4 hover:underline">
          {t("pricing.details")}
        </Link>
      </section>

      <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-14">
        <h2 className="text-3xl font-extrabold tracking-tight">{t("faq.title")}</h2>
        <Faq items={faq} />
      </section>

      <section className="px-4 pb-16">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 rounded-[32px] bg-primary px-6 py-12 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight">{t("cta.title")}</h2>
          <Link href="/inscription" className="inline-flex min-h-13 items-center rounded-2xl bg-white px-6 font-bold text-ink hover:bg-cream">
            {t("cta.button")}
          </Link>
        </div>
      </section>
    </>
  );
}
