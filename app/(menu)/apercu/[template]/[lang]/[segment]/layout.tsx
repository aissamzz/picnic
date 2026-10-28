import { MenuDocument } from "@/components/menu/menu-document";
import { isLocale } from "@/lib/i18n/config";

export default async function PreviewLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <MenuDocument lang={isLocale(lang) ? lang : "fr"}>{children}</MenuDocument>;
}
