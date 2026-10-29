import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { createClient } from "@/lib/supabase/server";

type Overview = {
  by_status: Record<string, number>;
  signups_7d: number;
  live: number;
  trials_ending_2d: number;
  renewals_30d: number;
  payments_pending: number;
  kits_open: number;
  revenue_month: number;
  mrr: number;
  visits_7d: number;
  orders_7d: number;
};

function Tile({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <Card className="flex h-full flex-col gap-1 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-3xl font-bold tabular">{value}</span>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-lg hover:ring-2 hover:ring-primary/30">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminOverview() {
  const t = await getTranslations("admin.overview");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as Locale;
  const f = await getFormatter();
  const { data } = await (await createClient()).rpc("admin_overview");
  const o = data as unknown as Overview;
  const n = (v: number) => f.number(v);
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("pendingPayments")} value={n(o.payments_pending)} href="/admin/paiements" />
        <Tile label={t("trialsEnding")} value={n(o.trials_ending_2d)} href="/admin/appels" />
        <Tile label={t("renewals")} value={n(o.renewals_30d)} href="/admin/renouvellements" />
        <Tile label={t("openKits")} value={n(o.kits_open)} href="/admin/kits" />
        <Tile label={t("revenue")} value={formatPrice(o.revenue_month, locale)} />
        <Tile label={t("mrr")} value={formatPrice(o.mrr, locale)} />
        <Tile label={t("signups")} value={n(o.signups_7d)} href="/admin/restaurants" />
        <Tile label={t("live")} value={n(o.live)} />
        <Tile label={t("visits")} value={n(o.visits_7d)} />
        <Tile label={t("orders")} value={n(o.orders_7d)} />
      </div>
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">{t("byStatus")}</h2>
        <dl className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {(["trial", "active", "grace", "expired", "suspended", "paused"] as const).map((s) => (
            <div key={s} className="rounded-md bg-sand p-3">
              <dt className="text-sm text-muted">{ts(s)}</dt>
              <dd className="text-xl font-bold tabular">{n(o.by_status[s] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
