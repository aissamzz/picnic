import { OfflineBanner, SubscriptionBanner } from "@/components/ui/banners";
import { LanguagePicker } from "@/components/ui/language-picker";
import { requireRestaurant } from "@/lib/auth/session";
import { bannerFor } from "@/lib/subscription/banner";
import { OWNER_NOTIFICATIONS } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { BottomNav } from "./bottom-nav";
import { CallsChip } from "./calls-chip";
import { NotificationsBell } from "./notifications-bell";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await requireRestaurant();
  // Staff see the lock (LockedNotice) but not billing.
  const banner = restaurant.role === "owner" ? bannerFor(restaurant) : null;
  const tn = await getTranslations("notifications");
  let unreadQuery = (await createClient())
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id)
    .is("read_at", null);
  if (restaurant.role !== "owner") unreadQuery = unreadQuery.not("kind", "in", `(${Object.keys(OWNER_NOTIFICATIONS).join(",")})`);
  const { count: unread } = await unreadQuery;
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-sand/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <p className="truncate font-semibold">{restaurant.name}</p>
          <div className="flex items-center gap-2">
            <CallsChip restaurantId={restaurant.id} />
            <NotificationsBell count={unread ?? 0} label={tn("bell", { count: unread ?? 0 })} />
            <LanguagePicker />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">
        {banner && <SubscriptionBanner {...banner} href="/app/abonnement" className="mb-4" />}
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
