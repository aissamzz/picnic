import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { APP_URL } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "./team-manager";

export default async function TeamPage() {
  const restaurant = await requireOwnerRestaurant();
  const t = await getTranslations("owner.team");
  const { data } = await (await createClient()).rpc("team_members", { p_restaurant_id: restaurant.id });
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/plus" label={(await getTranslations("more"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <TeamManager
        editable={editable}
        restaurantName={restaurant.name}
        inviteBase={`${APP_URL}/invitation/`}
        members={(data ?? []).map((m) => ({ id: m.id, role: m.role, status: m.status, name: m.full_name, phone: m.phone, token: m.invite_token }))}
      />
    </div>
  );
}
