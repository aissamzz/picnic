import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminFullMenu } from "@/lib/menu/admin-data";
import type { I18nText } from "@/lib/menu/types";
import { createClient } from "@/lib/supabase/server";
import { CombosManager } from "./combos-manager";

export default async function CombosPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin.combos");
  const [menu, { data: combos }] = await Promise.all([
    adminFullMenu(restaurant.id),
    (await createClient())
      .from("combos")
      .select("id, name, description, price, photo, item_ids, is_visible, is_sold_out")
      .eq("restaurant_id", restaurant.id)
      .is("deleted_at", null)
      .order("position")
      .order("created_at"),
  ]);
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={(await getTranslations("menuAdmin"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <CombosManager
        editable={editable}
        locale={(await getLocale()) as Locale}
        categories={menu.map((c) => ({ id: c.id, name: c.name, items: c.items.map((i) => ({ id: i.id, name: i.name })) }))}
        combos={(combos ?? []).map((c) => ({ ...c, name: c.name as I18nText, description: c.description as I18nText }))}
      />
    </div>
  );
}
