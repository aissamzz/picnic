import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { requireOwnerRestaurant, requireSession } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { InfoStep } from "../../../onboarding/steps/info-step";

export default async function InfoSettingsPage() {
  const { profile } = await requireSession();
  const restaurant = await requireOwnerRestaurant();
  const { data } = await (await createClient())
    .from("restaurants")
    .select("name, slug, type, wilaya_code, commune, address, whatsapp_order_phone, logo_path")
    .eq("id", restaurant.id)
    .single();
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/plus" label={(await getTranslations("more"))("title")} />
      <InfoStep initial={data} accountPhone={profile.phone} locale={(await getLocale()) as Locale} mode="settings" />
    </div>
  );
}
