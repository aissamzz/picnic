import { MenuDocument } from "@/components/menu/menu-document";
import { menuLang } from "@/components/menu/render-menu";
import { getPublicMenu } from "@/lib/menu/public-menu";
import { parseMenuSegment } from "@/lib/slug";

/** Root layout of the cached public menus (rewritten from /{slug} by the middleware). */
export default async function MenuLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string; segment: string }> }) {
  const { lang, segment } = await params;
  const menu = await getPublicMenu(parseMenuSegment(decodeURIComponent(segment)).slug);
  return <MenuDocument lang={menuLang(lang, menu)}>{children}</MenuDocument>;
}
