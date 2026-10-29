import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderMenu } from "@/components/menu/render-menu";
import { APP_NAME } from "@/lib/config";
import { isLocale } from "@/lib/i18n/config";
import type { Lang } from "@/lib/menu/types";
import { demoMenu, templateForNumber } from "@/lib/templates/demo-menus";

/**
 * Demo menu of each template, public at /template-1 … /template-9 (the
 * middleware rewrites here). `?nom=` shows the visitor's restaurant name
 * (onboarding preview). No database, no analytics, ordering off.
 */
export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const key = templateForNumber(Number((await params).n));
  return { title: key ? `${demoMenu(key).restaurant.name} · ${APP_NAME}` : APP_NAME, robots: { index: false, follow: true } };
}

export default async function DemoTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ n: string; lang: string }>;
  searchParams: Promise<{ nom?: string }>;
}) {
  const { n, lang } = await params;
  const { nom } = await searchParams;
  const key = templateForNumber(Number(n));
  if (!key || !isLocale(lang)) notFound();
  const suffix = nom ? `&nom=${encodeURIComponent(nom)}` : "";
  const langHref: Record<Lang, string> = { fr: `/template-${n}?lang=fr${suffix}`, ar: `/template-${n}?lang=ar${suffix}` };
  return <RenderMenu templateKey={key} menu={demoMenu(key, { name: nom })} lang={lang} mode="order" preview={{ langHref }} />;
}
