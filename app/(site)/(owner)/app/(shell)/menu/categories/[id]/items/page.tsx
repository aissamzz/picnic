import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { Button } from "@/components/ui/button";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminCategoryItems } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { ItemsBoard } from "./items-board";

export default async function CategoryItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const locale = (await getLocale()) as Locale;
  const data = await adminCategoryItems(restaurant.id, id).catch(() => null);
  if (!data) notFound();
  const editable = canEditMenu(restaurant.status);
  const name = tx(data.category.name, locale);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={t("backToMenu")} />
      <div className="flex items-start justify-between gap-2">
        <h1 className="text-2xl font-bold">{name}</h1>
        {editable && (
          <Button asChild variant="ghost" size="icon" aria-label={t("edit", { name })}>
            <Link href={`/app/menu/categories/${id}`}>
              <Pencil />
            </Link>
          </Button>
        )}
      </div>
      {!editable && <LockedNotice />}
      <ItemsBoard items={data.items} editable={editable} locale={locale} />
      {editable && (
        <Button asChild size="lg" block>
          <Link href={`/app/menu/items/new?category=${id}`}>
            <Plus aria-hidden />
            {t("addItem")}
          </Link>
        </Button>
      )}
    </div>
  );
}
