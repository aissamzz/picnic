"use client";

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";

export type Stats = {
  days: { day: string; table: number; order: number; orders: number }[];
  sources: { source: string; visits: number }[];
  tables: { label: string; visits: number; calls: number }[];
  top_items: { name: Record<string, string>; views: number }[];
  hours: { hour: number; visits: number }[];
  orders: { count: number; flagged: number; total: number };
  calls: number;
};

const Charts = dynamic(() => import("./charts"), { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> });

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-bold tabular">{value}</span>
    </Card>
  );
}

/** Ranked list with a thin bar per row: easier to read than a chart for names. */
function Ranked({ title, rows }: { title: string; rows: { key: string; label: string; value: number; extra?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return null;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-semibold">{title}</h2>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 tabular text-muted">
                {r.extra && <span className="me-2">{r.extra}</span>}
                <span className="font-semibold text-ink">{r.value}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-sand" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StatsView({ stats }: { stats: Stats | null }) {
  const t = useTranslations("owner.stats");
  const ts = useTranslations("owner.share.sources");
  const locale = useLocale();
  if (!stats) return null;
  const tableVisits = stats.days.reduce((n, d) => n + d.table, 0);
  const orderVisits = stats.days.reduce((n, d) => n + d.order, 0);
  const empty = tableVisits + orderVisits === 0 && stats.orders.count === 0;
  const fmt = (n: number) => n.toLocaleString(locale === "ar" ? "ar-DZ-u-nu-latn" : "fr-DZ");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label={t("tableVisits")} value={fmt(tableVisits)} />
        <Tile label={t("orderVisits")} value={fmt(orderVisits)} />
        <Tile label={t("ordersSent")} value={fmt(stats.orders.count)} />
        <Tile label={t("ordersTotal")} value={formatPrice(stats.orders.total, locale as Locale)} />
        <Tile label={t("calls")} value={fmt(stats.calls)} />
      </div>
      {empty ? (
        <Card className="p-6 text-center text-muted">{t("noData")}</Card>
      ) : (
        <>
          <Charts days={stats.days} hours={stats.hours} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Ranked title={t("byChannel")} rows={stats.sources.map((s) => ({ key: s.source, label: ts.has(s.source) ? ts(s.source as never) : s.source, value: s.visits }))} />
            <Ranked
              title={t("byTable")}
              rows={stats.tables.map((r, i) => ({ key: `${r.label}-${i}`, label: r.label, value: r.visits, extra: r.calls ? t("tableCalls", { count: r.calls }) : undefined }))}
            />
            <Ranked title={t("topItems")} rows={stats.top_items.map((r, i) => ({ key: String(i), label: r.name[locale] || r.name.fr || Object.values(r.name)[0] || "", value: r.views }))} />
          </div>
        </>
      )}
    </div>
  );
}
