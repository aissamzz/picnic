import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminCategories, adminItem } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { ItemEditor } from "./item-editor";

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {
  const { id } = await params;
  const { category } = await searchParams;
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const locale = (await getLocale()) as Locale;
  const categories = await adminCategories(restaurant.id);
  const item = id === "new" ? null : await adminItem(restaurant.id, id).catch(() => null);
  if (id !== "new" && !item) notFound();
  const categoryId = item?.categoryId ?? (categories.some((c) => c.id === category) ? category! : categories[0]?.id);
  if (!categoryId) notFound();
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/app/menu/categories/${categoryId}/items`} label={t("backToCategory")} />
      <h1 className="text-2xl font-bold">{item ? t("item.editTitle") : t("item.newTitle")}</h1>
      {!editable && <LockedNotice />}
      <ItemEditor
        item={item}
        defaultCategoryId={categoryId}
        categories={categories.map((c) => ({ id: c.id, name: tx(c.name, locale) }))}
        editable={editable}
      />
    </div>
  );
}
