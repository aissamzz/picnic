import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { menuLinks } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { OrderSettingsForm } from "./order-settings-form";

export default async function OrderSettingsPage() {
  const restaurant = await requireOwnerRestaurant();
  const t = await getTranslations("owner.orders");
  const supabase = await createClient();
  const [{ data: r }, { data: zones }] = await Promise.all([
    supabase.from("restaurants").select("orders_enabled, whatsapp_order_phone, delivery_enabled, takeaway_enabled, min_order, eta_label").eq("id", restaurant.id).single(),
    supabase.from("delivery_zones").select("id, name, fee").eq("restaurant_id", restaurant.id).order("position"),
  ]);
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/plus" label={(await getTranslations("more"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <OrderSettingsForm initial={{ ...r!, zones: zones ?? [] }} editable={editable} orderUrl={menuLinks(restaurant.slug).orderUrl} />
    </div>
  );
}
