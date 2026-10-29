import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { statusTone } from "@/lib/subscription/state";
import { createClient } from "@/lib/supabase/server";
import { ContactButtons } from "../contact-buttons";
import { QuickCall } from "../quick-call";

export default async function Renewals() {
  const t = await getTranslations("admin.renewals");
  const td = await getTranslations("admin.detail");
  const ts = await getTranslations("status");
  const tb = await getTranslations("billing.plans");
  const f = await getFormatter();
  const date = (iso: string) => f.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" });
  const { data } = await (await createClient()).rpc("admin_renewals");
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {!data?.length ? (
        <Card className="p-6 text-center text-muted">{t("empty")}</Card>
      ) : (
        <Card className="divide-y divide-line">
          {data.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-4" aria-label={r.name}>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/restaurants/${r.id}`} className="text-lg font-semibold hover:underline">
                  {r.name}
                </Link>
                <StatusPill tone={statusTone(r.status)}>{ts(r.status)}</StatusPill>
                {r.plan && <span className="text-sm">{tb(r.plan)}</span>}
                <span className="text-sm text-muted">
                  {t("ends")} : {date(r.paid_until)}
                </span>
                {r.pending_payment && <Badge tone="info">{t("pending")}</Badge>}
                <Badge tone={r.reminded_at ? "success" : "neutral"}>{r.reminded_at ? t("reminded", { date: date(r.reminded_at) }) : t("notReminded")}</Badge>
                {r.last_outcome && r.last_call_at && (
                  <span className="text-sm text-muted">
                    {t("lastCall")} : {td(`outcomes.${r.last_outcome}`)} · {date(r.last_call_at)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {r.owner_name}
                  <ContactButtons phone={r.owner_phone} callLabel={td("call")} />
                </span>
                <QuickCall restaurantId={r.id} />
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
