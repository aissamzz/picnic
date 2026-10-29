import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { statusTone } from "@/lib/subscription/state";
import { createClient } from "@/lib/supabase/server";
import { ContactButtons } from "../contact-buttons";
import { QuickCall } from "../quick-call";

export default async function CallList() {
  const t = await getTranslations("admin.callList");
  const td = await getTranslations("admin.detail");
  const ts = await getTranslations("status");
  const f = await getFormatter();
  const { data } = await (await createClient()).rpc("admin_call_list");
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
                <Badge tone={r.called_today ? "success" : "warning"}>{r.called_today ? t("called") : t("notCalled")}</Badge>
                <span className="text-sm text-muted">
                  {t("ends", { date: f.dateTime(new Date(r.ends_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })} · {t("visits", { count: r.visits_7d })} ·{" "}
                  {t("items", { count: r.items })}
                </span>
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
