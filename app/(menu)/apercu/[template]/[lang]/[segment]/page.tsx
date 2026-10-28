import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderMenu } from "@/components/menu/render-menu";
import { isLocale } from "@/lib/i18n/config";
import { getPublicMenu } from "@/lib/menu/public-menu";
import type { Lang } from "@/lib/menu/types";
import { parseMenuSegment } from "@/lib/slug";
import { TEMPLATE_KEYS } from "@/lib/templates/meta";

/**
 * Preview of a public menu in any template and language:
 * /apercu/{template}/{fr|ar}/{slug or slug-menu}. Uncached, not indexed,
 * no analytics. Used by the appearance editor and template QA.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PreviewPage({ params }: { params: Promise<{ template: string; lang: string; segment: string }> }) {
  const { template, lang, segment } = await params;
  if (!(TEMPLATE_KEYS as readonly string[]).includes(template) || !isLocale(lang)) notFound();
  const { slug, mode } = parseMenuSegment(decodeURIComponent(segment).toLowerCase());
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();
  // Preview shows both languages even if the restaurant has one enabled.
  const preview: Record<Lang, string> = {
    fr: `/apercu/${template}/fr/${segment}`,
    ar: `/apercu/${template}/ar/${segment}`,
  };
  return (
    <RenderMenu
      templateKey={template}
      menu={{ ...menu, restaurant: { ...menu.restaurant, template_key: template, enabled_locales: ["fr", "ar"] } }}
      lang={lang}
      mode={mode}
      preview={{ langHref: preview }}
    />
  );
}
