import { FileDown, Package, Paperclip } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BillingForm } from "./billing-form";

const TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;

export default async function BillingPage() {
  const r = await requireOwnerRestaurant();
  const t = await getTranslations("billing");
  const ts = await getTranslations("status");
  const locale = (await getLocale()) as Locale;
  const f = await getFormatter();
  const supabase = await createClient();
  const [{ data: billing }, { data: details }, { data: payments }] = await Promise.all([
    supabase.from("restaurant_billing").select("status, trial_ends_at, paid_until, plan, payment_reference").eq("id", r.id).single(),
    supabase.rpc("payment_details").maybeSingle(),
    supabase.from("payments").select("id, plan, method, amount, status, reject_reason, created_at, period_start, period_end, receipt_path").eq("restaurant_id", r.id).order("created_at", { ascending: false }),
  ]);
  // The view's columns are typed nullable; the row exists for an owner.
  const b = { ...billing!, status: billing!.status ?? "trial", trial_ends_at: billing!.trial_ends_at ?? "", payment_reference: billing!.payment_reference ?? "" };
  const date = (iso: string | null) => (iso ? f.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" }) : "");
  const pending = payments?.find((p) => p.status === "pending");
  // Short-lived links to the owner's own receipts. The rows were read through
  // RLS above, so signing them with the service key exposes nothing more.
  const storage = createServiceClient().storage.from("receipts");
  const signed = new Map<string, string>();
  await Promise.all(
    (payments ?? []).flatMap((p) =>
      p.receipt_path
        ? [storage.createSignedUrl(p.receipt_path, 600).then(({ data }) => data && signed.set(p.receipt_path!, data.signedUrl))]
        : [],
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/plus" label={(await getTranslations("more"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{t("current")}</h2>
          <Badge tone={b.status === "active" ? "success" : b.status === "trial" ? "info" : b.status === "grace" ? "warning" : "danger"}>{ts(b.status)}</Badge>
        </div>
        {b.plan && b.status === "active" && <p>{t("planMonths." + b.plan)}</p>}
        <p className="text-sm text-muted">
          {b.status === "trial"
            ? t("trialUntil", { date: date(b.trial_ends_at) })
            : b.status === "expired"
              ? t("expiredBody")
              : b.paid_until
                ? t("until", { date: date(b.paid_until) })
                : t("trialUntil", { date: date(b.trial_ends_at) })}
        </p>
        <div className="flex items-center justify-between gap-3 rounded-md bg-sand px-3 py-2">
          <div>
            <p className="text-xs text-muted">{t("reference")}</p>
            <p className="text-xl font-bold tabular" dir="ltr">
              {b.payment_reference}
            </p>
          </div>
          <CopyButton value={b.payment_reference} label={t("copy")} copiedLabel={t("copied")} variant="secondary" size="sm" />
        </div>
        <p className="text-sm text-muted">{t("referenceHint")}</p>
      </Card>

      {pending ? (
        <Card className="flex flex-col gap-1 border-warning/40 bg-warning-soft p-4" role="status">
          <p className="font-semibold">{t("pendingTitle")}</p>
          <p className="text-sm">
            {t("pendingBody", { plan: t(`plans.${pending.plan}`), amount: formatPrice(pending.amount, locale), date: date(pending.created_at) })}
          </p>
        </Card>
      ) : (
        <BillingForm
          reference={b.payment_reference}
          prices={{ monthly: details?.price_monthly ?? 2500, semiannual: details?.price_semiannual ?? 13500, annual: details?.price_annual ?? 24000 }}
          details={{ rip: details?.baridimob_rip ?? null, ccp: details?.ccp_number ?? null, ccpKey: details?.ccp_key ?? null, ccpHolder: details?.ccp_holder ?? null }}
        />
      )}

      <Link href="/app/kit" className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 hover:bg-sand">
        <Package className="size-6 shrink-0 text-clay" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">{t("kitTitle")}</span>
          <span className="block text-sm text-muted">{t("kitBody")}</span>
        </span>
        <span className="text-sm font-semibold text-primary">{t("kitCta")}</span>
      </Link>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t("history")}</h2>
        {!payments?.length ? (
          <p className="text-sm text-muted">{t("historyEmpty")}</p>
        ) : (
          <Card className="divide-y divide-line">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-col gap-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {t(`plans.${p.plan}`)} · {formatPrice(p.amount, locale)}
                  </p>
                  <Badge tone={TONE[p.status]}>{t(`statuses.${p.status}`)}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {t(`methods.${p.method}`)} · {date(p.created_at)}
                  {p.period_start && p.period_end && <> · {t("period", { from: date(p.period_start), to: date(p.period_end) })}</>}
                </p>
                {p.status === "rejected" && p.reject_reason && <p className="text-sm text-danger">{t("rejectedReason", { reason: p.reject_reason })}</p>}
                <div className="flex flex-wrap gap-4 text-sm font-semibold">
                  {p.receipt_path && signed.get(p.receipt_path) && (
                    <a href={signed.get(p.receipt_path)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-primary">
                      <Paperclip className="size-4" aria-hidden />
                      {t("viewReceipt")}
                    </a>
                  )}
                  {p.status === "approved" && (
                    <a href={`/app/abonnement/recu/${p.id}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary">
                      <FileDown className="size-4" aria-hidden />
                      {t("receiptPdf")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
