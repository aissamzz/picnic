import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import type { I18nText } from "@/lib/menu/types";
import { createClient } from "@/lib/supabase/server";
import { BestSellersPicker } from "./best-sellers-picker";

export default async function BestSellersPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin.bestSellers");
  const { data } = await (await createClient())
    .from("categories")
    .select("id, name, position, items(id, name, photos, tags, position, deleted_at)")
    .eq("restaurant_id", restaurant.id)
    .is("deleted_at", null)
    .order("position");
  const categories = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name as I18nText,
    items: c.items
      .filter((i) => !i.deleted_at)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ id: i.id, name: i.name as I18nText, photo: i.photos[0] ?? null, on: i.tags.includes("best_seller") })),
  }));
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={(await getTranslations("menuAdmin"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <BestSellersPicker categories={categories} editable={editable} locale={(await getLocale()) as Locale} />
    </div>
  );
}
