import { getTranslations } from "next-intl/server";
import { requireRestaurant } from "@/lib/auth/session";
import { CallsBoard } from "./calls-board";

export default async function CallsPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("owner.calls");
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <CallsBoard restaurantId={restaurant.id} />
    </div>
  );
}
