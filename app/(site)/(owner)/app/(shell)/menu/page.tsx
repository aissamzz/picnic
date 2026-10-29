import { CalendarClock, ChevronRight, Coins, Languages, Layers, ScanText, Star } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminCategories } from "@/lib/menu/admin-data";
import { CategoriesBoard } from "./categories-board";

export default async function MenuPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const ti = await getTranslations("import");
  const categories = await adminCategories(restaurant.id);
  const editable = canEditMenu(restaurant.status);
  const tools = [
    { href: "/app/menu/prix", label: t("tools.prices"), icon: Coins },
    { href: "/app/menu/traductions", label: t("tools.translations"), icon: Languages },
    { href: "/app/menu/horaires", label: t("tools.schedules"), icon: CalendarClock },
    { href: "/app/menu/meilleures-ventes", label: t("tools.bestSellers"), icon: Star },
    { href: "/app/menu/combos", label: t("tools.combos"), icon: Layers },
  ];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {!editable && <LockedNotice />}
      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {tools.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-ink/30">
            <Icon className="size-4 text-muted" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      {editable && (
        <Link href="/app/menu/importer" className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 hover:bg-sand">
          <ScanText className="size-5 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">{ti("menuLink")}</span>
            <span className="block text-sm text-muted">{ti("menuLinkHint")}</span>
          </span>
          <ChevronRight className="size-5 text-muted rtl:rotate-180" aria-hidden />
        </Link>
      )}
      <CategoriesBoard categories={categories} editable={editable} locale={(await getLocale()) as Locale} />
    </div>
  );
}
