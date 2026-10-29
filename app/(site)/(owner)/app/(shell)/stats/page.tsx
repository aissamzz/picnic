import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cx } from "@/lib/utils/cx";
import { OrdersLog, type OrderRow } from "./orders-log";
import { StatsView, type Stats } from "./stats-view";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const restaurant = await requireRestaurant();
  const days = (await searchParams).j === "30" ? 30 : 7;
  const t = await getTranslations("owner.stats");
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [{ data: stats }, { data: orders }] = await Promise.all([
    supabase.rpc("restaurant_stats", { p_restaurant_id: restaurant.id, p_days: days }),
    supabase
      .from("orders")
      .select("id, public_id, mode, customer_name, customer_phone, items, subtotal, delivery_fee, status, created_at")
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <nav aria-label={t("period")} className="inline-flex rounded-full border border-line bg-surface p-1">
          {[7, 30].map((d) => (
            <Link
              key={d}
              href={d === 7 ? "/app/stats" : "/app/stats?j=30"}
              aria-current={d === days ? "page" : undefined}
              className={cx("inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold", d === days ? "bg-ink text-surface" : "text-muted hover:text-ink")}
            >
              {t(d === 7 ? "days7" : "days30")}
            </Link>
          ))}
        </nav>
      </div>
      <StatsView stats={stats as unknown as Stats} />
      <OrdersLog orders={(orders ?? []) as unknown as OrderRow[]} />
    </div>
  );
}
