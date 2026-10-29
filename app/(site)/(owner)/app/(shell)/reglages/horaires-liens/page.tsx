import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { HoursLinksForm } from "./hours-links-form";

export default async function HoursLinksPage() {
  const restaurant = await requireOwnerRestaurant();
  const t = await getTranslations("owner.hoursLinks");
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: hours }, { data: exceptions }, { data: links }] = await Promise.all([
    supabase.from("opening_hours").select("weekday, opens, closes").eq("restaurant_id", restaurant.id).order("weekday").order("opens"),
    supabase.from("opening_exceptions").select("date, note").eq("restaurant_id", restaurant.id).gte("date", today).order("date"),
    supabase.from("social_links").select("instagram, facebook, tiktok, maps_url, google_review_url").eq("restaurant_id", restaurant.id).maybeSingle(),
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
      <HoursLinksForm
        editable={editable}
        initial={{
          hours: (hours ?? []).map((h) => ({ weekday: h.weekday, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })),
          exceptions: (exceptions ?? []).map((e) => ({ date: e.date, note: e.note ?? "" })),
          links: {
            instagram: links?.instagram ?? "",
            facebook: links?.facebook ?? "",
            tiktok: links?.tiktok ?? "",
            maps_url: links?.maps_url ?? "",
            google_review_url: links?.google_review_url ?? "",
          },
        }}
      />
    </div>
  );
}
