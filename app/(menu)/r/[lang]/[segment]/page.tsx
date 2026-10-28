import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { menuLang, RenderMenu } from "@/components/menu/render-menu";
import { APP_NAME, TABLE_SLUG_SUFFIX } from "@/lib/config";
import { getPublicMenu, resolveSlug } from "@/lib/menu/public-menu";
import { parseMenuSegment } from "@/lib/slug";
import { publicImageUrl } from "@/lib/storage";

// ISR: rendered on first visit, cached, refreshed by revalidateTag on owner edits.
export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ lang: string; segment: string }> };

async function load({ params }: Params) {
  const { lang, segment } = await params;
  const { slug, mode } = parseMenuSegment(decodeURIComponent(segment).toLowerCase());
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();
  // Normally handled by the middleware (which keeps ?t=); this is the fallback.
  if (resolved.redirect) permanentRedirect(`/${resolved.slug}${mode === "table" ? TABLE_SLUG_SUFFIX : ""}`);
  const menu = await getPublicMenu(resolved.slug);
  if (!menu) notFound();
  return { menu, mode, lang: menuLang(lang, menu) };
}

export async function generateMetadata(p: Params): Promise<Metadata> {
  const { menu, mode } = await load(p);
  const r = menu.restaurant;
  const image = publicImageUrl(r.cover_path) ?? publicImageUrl(r.logo_path);
  const where = [r.commune].filter(Boolean).join(", ");
  return {
    title: { absolute: where ? `${r.name} · ${where}` : r.name },
    description: `${r.name}${where ? ` (${where})` : ""} · Menu ${APP_NAME}`,
    alternates: { canonical: `/${r.slug}` },
    // Table links duplicate the order link: keep them out of search results.
    robots: mode === "table" || r.is_paused ? { index: false } : undefined,
    openGraph: { title: r.name, images: image ? [image] : undefined },
  };
}

export default async function PublicMenuPage(p: Params) {
  const { menu, mode, lang } = await load(p);
  return <RenderMenu templateKey={menu.restaurant.template_key} menu={menu} lang={lang} mode={mode} />;
}
