import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { KitBoard, type KitCard } from "./kit-board";

export default async function Kits() {
  const t = await getTranslations("admin.kits");
  const { data } = await (await createClient())
    .from("kit_orders")
    .select("id, stage, stands_count, posters_count, cod_amount, owner_feedback, mockup_path, tracking_number, commune, wilaya_code, created_at, restaurant:restaurants(id, name)")
    .order("created_at");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <KitBoard kits={(data ?? []) as unknown as KitCard[]} />
    </div>
  );
}
