import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminFullMenu } from "@/lib/menu/admin-data";
import { PriceEditor } from "./price-editor";

export default async function PricesPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const menu = await adminFullMenu(restaurant.id);
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={t("backToMenu")} />
      <div>
        <h1 className="text-2xl font-bold">{t("prices.title")}</h1>
        <p className="text-muted">{t("prices.subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <PriceEditor menu={menu} editable={editable} locale={(await getLocale()) as Locale} />
    </div>
  );
}
