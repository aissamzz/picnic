import { ArrowLeft, Eye, MessageCircle, Phone, QrCode } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import type { Locale } from "@/lib/i18n/config";
import { menuLinks } from "@/lib/links";
import { formatPrice } from "@/lib/price";
import { statusTone } from "@/lib/subscription/state";
import { createClient } from "@/lib/supabase/server";
import { formatDzPhone } from "@/lib/utils/phone";
import { viewAs } from "../../actions";
import { CallForm, NoteForm, RestaurantActions } from "./detail-forms";

export default async function AdminRestaurant({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await getTranslations("admin.detail");
  const ts = await getTranslations("status");
  const tb = await getTranslations("billing");
  const tk = await getTranslations("kit.stages");
  const f = await getFormatter();
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const [{ data: list }, { data: payments }, { data: kit }, { data: notes }, { data: calls }, { data: audit }] = await Promise.all([
    supabase.rpc("admin_restaurants"),
    supabase.from("payments").select("id, plan, method, amount, status, created_at, reject_reason").eq("restaurant_id", id).order("created_at", { ascending: false }),
    supabase.from("kit_orders").select("stage, created_at").eq("restaurant_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("admin_notes").select("id, body, created_at").eq("restaurant_id", id).order("created_at", { ascending: false }),
    supabase.from("admin_calls").select("id, outcome, note, next_action_at, created_at").eq("restaurant_id", id).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id, action, created_at, payload").eq("restaurant_id", id).order("created_at", { ascending: false }).limit(40),
  ]);
  const r = list?.find((x) => x.id === id);
  if (!r) notFound();
  const date = (iso: string | null) => (iso ? f.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric" }) : "–");
  const when = (iso: string) => f.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const links = menuLinks(r.slug);
  const phone = r.owner_phone ? `+${r.owner_phone.replace(/^\+/, "")}` : null;

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <Link href="/admin/restaurants" className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{r.name}</h1>
        <StatusPill tone={statusTone(r.status)}>{ts(r.status)}</StatusPill>
        <span className="text-sm text-muted">
          {t("since", { date: date(r.created_at) })} · {t("ends", { date: date(r.paid_until ?? r.trial_ends_at) })}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-semibold">{t("contact")}</h2>
            <p>
              {r.owner_name ?? "–"}
              {phone && (
                <bdi dir="ltr" className="ms-2 text-muted tabular">
                  {formatDzPhone(phone)}
                </bdi>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {phone && (
                <>
                  <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 font-semibold text-white">
                    <Phone className="size-4" aria-hidden />
                    {t("call")}
                  </a>
                  <a href={`https://wa.me/${phone.slice(1)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold">
                    <MessageCircle className="size-4" aria-hidden />
                    {t("whatsapp")}
                  </a>
                </>
              )}
              <a href={links.orderUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold">
                <QrCode className="size-4" aria-hidden />
                {t("viewMenu")}
              </a>
              <form action={viewAs.bind(null, r.id)}>
                <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold">
                  <Eye className="size-4" aria-hidden />
                  {t("viewAs")}
                </button>
              </form>
            </div>
          </Card>

          <RestaurantActions restaurantId={r.id} status={r.status} />

          <Card className="flex flex-col gap-2 p-4">
            <h2 className="font-semibold">{t("payments")}</h2>
            {!payments?.length ? (
              <p className="text-sm text-muted">{t("noPayments")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {tb(`plans.${p.plan}`)} · {formatPrice(p.amount, locale)} · {tb(`methods.${p.method}`)} · {date(p.created_at)}
                    </span>
                    <Badge tone={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "danger"}>{tb(`statuses.${p.status}`)}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {kit && (
              <p className="text-sm">
                {t("kit")} : <strong>{tk(kit.stage)}</strong> ({date(kit.created_at)})
              </p>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-semibold">{t("callLog")}</h2>
            <CallForm restaurantId={r.id} />
            {!calls?.length ? (
              <p className="text-sm text-muted">{t("noCalls")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {calls.map((c) => (
                  <li key={c.id} className="py-2">
                    <span className="font-semibold">{t(`outcomes.${c.outcome}`)}</span> · {when(c.created_at)}
                    {c.next_action_at && <> · {t("nextCall")} {date(c.next_action_at)}</>}
                    {c.note && <p className="text-muted">{c.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="font-semibold">{t("notes")}</h2>
            <NoteForm restaurantId={r.id} />
            {!notes?.length ? (
              <p className="text-sm text-muted">{t("noNotes")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {notes.map((n) => (
                  <li key={n.id} className="py-2">
                    <p className="whitespace-pre-line">{n.body}</p>
                    <p className="text-xs text-muted">{when(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-2 p-4">
            <h2 className="font-semibold">{t("timeline")}</h2>
            <ol className="flex flex-col gap-1.5 text-sm">
              {(audit ?? []).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted tabular">{when(a.created_at)}</span>
                  <span className="font-mono text-xs">{a.action}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
