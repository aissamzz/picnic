import { getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { adminCategories } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { createClient } from "@/lib/supabase/server";
import { SchedulesEditor } from "./schedules-editor";

export default async function SchedulesPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const [{ data: schedules }, categories] = await Promise.all([
    supabase.from("menu_schedules").select("id, name, starts, ends, weekdays, is_active").eq("restaurant_id", restaurant.id).order("starts"),
    adminCategories(restaurant.id),
  ]);
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={t("backToMenu")} />
      <div>
        <h1 className="text-2xl font-bold">{t("schedules.title")}</h1>
        <p className="text-muted">{t("schedules.subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <SchedulesEditor
        schedules={(schedules ?? []).map((s) => ({
          ...s,
          starts: s.starts.slice(0, 5),
          ends: s.ends.slice(0, 5),
          categoryIds: categories.filter((c) => c.schedule_id === s.id).map((c) => c.id),
        }))}
        categories={categories.map((c) => ({ id: c.id, name: tx(c.name, locale), scheduleId: c.schedule_id }))}
        editable={editable}
      />
    </div>
  );
}
