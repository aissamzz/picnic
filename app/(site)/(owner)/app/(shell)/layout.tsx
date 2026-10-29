import { OfflineBanner } from "@/components/ui/banners";
import { LanguagePicker } from "@/components/ui/language-picker";
import { requireRestaurant } from "@/lib/auth/session";
import { BottomNav } from "./bottom-nav";
import { CallsChip } from "./calls-chip";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const restaurant = await requireRestaurant();
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-line bg-sand/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <p className="truncate font-semibold">{restaurant.name}</p>
          <div className="flex items-center gap-2">
            <CallsChip restaurantId={restaurant.id} />
            <LanguagePicker />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
