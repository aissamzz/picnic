import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { MenuImporter, Tips } from "@/components/owner/import/menu-importer";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { Card } from "@/components/ui/card";
import { requireRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ImporterPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("import");
  const tm = await getTranslations("menuAdmin");
  const editable = canEditMenu(restaurant.status);
  const { data: importsLeft } = await (await createClient()).rpc("ai_imports_left", { p_restaurant_id: restaurant.id });
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={tm("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {editable ? (
        <>
          <Card className="p-4">
            <Tips />
          </Card>
          <MenuImporter reviewPrefix="/app/menu/importer/" importsLeft={importsLeft ?? null} />
        </>
      ) : (
        <LockedNotice />
      )}
    </div>
  );
}
