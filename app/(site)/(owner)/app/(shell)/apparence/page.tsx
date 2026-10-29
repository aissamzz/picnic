import { getLocale, getTranslations } from "next-intl/server";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { TemplateKey } from "@/lib/templates/meta";
import { AppearanceEditor } from "./appearance-editor";

export default async function AppearancePage() {
  const restaurant = await requireOwnerRestaurant();
  const t = await getTranslations("owner.appearance");
  const supabase = await createClient();
  const { data } = await supabase.from("restaurants").select("template_key, primary_color, logo_path, cover_path").eq("id", restaurant.id).single();
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <AppearanceEditor
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        initial={{
          templateKey: data!.template_key as TemplateKey,
          primaryColor: data!.primary_color,
          logoUrl: publicImageUrl(data!.logo_path),
          coverUrl: publicImageUrl(data!.cover_path),
        }}
        defaultLang={(await getLocale()) as Locale}
        editable={editable}
      />
    </div>
  );
}
