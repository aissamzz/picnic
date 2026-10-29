import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { RestaurantsTable } from "./restaurants-table";

export default async function AdminRestaurants() {
  const t = await getTranslations("admin.restaurants");
  const { data } = await (await createClient()).rpc("admin_restaurants");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <RestaurantsTable rows={data ?? []} />
    </div>
  );
}
