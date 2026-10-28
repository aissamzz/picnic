import { getTranslations } from "next-intl/server";
import { requireRestaurant } from "@/lib/auth/session";
import { menuLinks } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_SWATCH, type TemplateKey } from "@/lib/templates/meta";
import { ShareHub, type ChannelStat } from "./share-hub";

export default async function SharePage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("owner.share");
  const supabase = await createClient();
  const [{ data: stats }, { data: style }] = await Promise.all([
    supabase.rpc("channel_stats", { p_restaurant_id: restaurant.id, p_days: 7 }),
    supabase.from("restaurants").select("primary_color").eq("id", restaurant.id).single(),
  ]);
  const swatch = TEMPLATE_SWATCH[restaurant.template_key as TemplateKey] ?? TEMPLATE_SWATCH.cafe;
  const colors = style?.primary_color ? { bg: style.primary_color, fg: "#FFFFFF" } : { bg: swatch.bg, fg: swatch.fg };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <ShareHub
        restaurantName={restaurant.name}
        slug={restaurant.slug}
        links={menuLinks(restaurant.slug)}
        stats={(stats ?? []) as ChannelStat[]}
        colors={colors}
      />
    </div>
  );
}
