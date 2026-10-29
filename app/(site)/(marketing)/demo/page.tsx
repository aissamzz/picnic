import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TemplateCards } from "@/components/marketing/template-cards";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.demo"))("metaTitle") };
}

export default async function DemoPage() {
  const t = await getTranslations("marketing.demo");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("body")}</p>
      </div>
      <TemplateCards layout="grid" />
      <Link href="/inscription" className="inline-flex min-h-13 items-center justify-center self-start rounded-2xl bg-primary px-6 font-bold text-white hover:bg-primary-hover">
        {t("cta")}
      </Link>
    </div>
  );
}
