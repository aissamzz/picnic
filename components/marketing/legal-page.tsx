import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { legalSections } from "@/lib/marketing/legal";
import { cn } from "@/lib/utils/cn";

export async function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const t = await getTranslations("marketing.legal");
  const sections = legalSections(kind, (await getLocale()) as Locale);
  const tabs = [
    { href: "/conditions", label: t("terms"), on: kind === "terms" },
    { href: "/confidentialite", label: t("privacy"), on: kind === "privacy" },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-10">
      <nav aria-label={t("contents")} className="flex gap-1 rounded-xl bg-white p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.on ? "page" : undefined}
            className={cn("flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-bold", tab.on ? "bg-ink text-white" : "text-muted hover:bg-cream")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">{kind === "terms" ? t("terms") : t("privacy")}</h1>
        <p className="mt-1 text-sm text-muted">{t("updated")}</p>
      </div>
      <nav aria-labelledby="toc" className="flex flex-col gap-1 rounded-2xl bg-white p-4">
        <p id="toc" className="text-xs font-extrabold tracking-wider text-muted uppercase">
          {t("contents")}
        </p>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-9 items-center font-semibold text-primary">
            {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20">
          <h2 className="mb-1 text-xl font-extrabold">{s.title}</h2>
          <p className="leading-relaxed whitespace-pre-line text-[#3A3150]">{s.body}</p>
        </section>
      ))}
      <p className="border-t border-line pt-4 text-sm text-muted">{t("draft")}</p>
    </div>
  );
}
