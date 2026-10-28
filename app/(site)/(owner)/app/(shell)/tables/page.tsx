import { FileDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { menuLinks } from "@/lib/links";
import { createClient } from "@/lib/supabase/server";
import { TablesEditor } from "./tables-editor";

export default async function TablesPage() {
  const restaurant = await requireOwnerRestaurant();
  const t = await getTranslations("owner.tables");
  const supabase = await createClient();
  const { data: tables } = await supabase.from("tables").select("id, code, label, zone, is_active").eq("restaurant_id", restaurant.id).order("position");
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      {(tables?.length ?? 0) > 0 && (
        <a
          href="/app/tables/pdf"
          download
          className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 hover:bg-sand"
        >
          <FileDown className="size-5 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">{t("pdfAll")}</span>
            <span className="block text-sm text-muted">{t("pdfHint")}</span>
          </span>
        </a>
      )}
      <TablesEditor
        tables={tables ?? []}
        editable={editable}
        restaurantName={restaurant.name}
        tableUrl={menuLinks(restaurant.slug).tableUrl}
        labelTemplate={restaurant.default_locale === "ar" ? "طاولة {n}" : "Table {n}"}
      />
    </div>
  );
}
