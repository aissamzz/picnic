"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { approvePayment, rejectPayment } from "../actions";

export type QueueItem = {
  id: string;
  plan: "monthly" | "semiannual" | "annual";
  method: "cod" | "baridimob" | "ccp" | "cash";
  amount: number;
  reference: string;
  created_at: string;
  restaurant: { id: string; name: string; slug: string };
  receiptUrl: string | null;
  isPdf: boolean;
};

export function PaymentCard({ p }: { p: QueueItem }) {
  const t = useTranslations("admin.payments");
  const tb = useTranslations("billing");
  const tr = useTranslations();
  const f = useFormatter();
  const locale = useLocale() as Locale;
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [other, setOther] = React.useState("");
  const reasons = t.raw("reasons") as string[];

  return (
    <Card className="grid gap-4 p-4 md:grid-cols-[240px_1fr]" aria-label={p.restaurant.name}>
      <div className="flex flex-col gap-2">
        {p.receiptUrl && !p.isPdf ? (
          <a href={p.receiptUrl} target="_blank" rel="noreferrer" title={t("openReceipt")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
            <img src={p.receiptUrl} alt={t("receipt")} className="max-h-72 w-full rounded-md border border-line object-contain" />
          </a>
        ) : null}
        {p.receiptUrl && (
          <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
            <ExternalLink className="size-4" aria-hidden />
            {t("openReceipt")}
          </a>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <Link href={`/admin/restaurants/${p.restaurant.id}`} className="text-lg font-semibold hover:underline">
            {p.restaurant.name}
          </Link>
          <p className="text-sm text-muted">{t("submittedAt", { date: f.dateTime(new Date(p.created_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>
            <dt className="text-muted">{tb("plan")}</dt>
            <dd className="font-semibold">{tb(`plans.${p.plan}`)}</dd>
          </div>
          <div>
            <dt className="text-muted">{tb("amount")}</dt>
            <dd className="font-semibold tabular">{formatPrice(p.amount, locale)}</dd>
          </div>
          <div>
            <dt className="text-muted">{tr("receiptPdf.method")}</dt>
            <dd className="font-semibold">{tb(`methods.${p.method}`)}</dd>
          </div>
          <div>
            <dt className="text-muted">{t("reference")}</dt>
            <dd className="font-semibold tabular" dir="ltr">
              {p.reference}
            </dd>
          </div>
        </dl>
        <FormAlert>{error && tr(error as never)}</FormAlert>
        <div className="flex gap-2">
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await approvePayment(p.id);
                if (!r.ok) return setError(r.error);
                toast(t("approved", { date: f.dateTime(new Date(r.data.paidUntil), { day: "numeric", month: "long", year: "numeric" }) }));
              })
            }
          >
            {t("approve")}
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)}>
            {t("reject")}
          </Button>
        </div>
      </div>
      <Dialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t("rejectTitle")}
        footer={
          <Button
            variant="danger"
            disabled={!(reason === "other" ? other.trim() : reason)}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await rejectPayment(p.id, reason === "other" ? other : reason);
                if (!r.ok) return setError(r.error);
                setRejecting(false);
                toast(t("rejected"));
              })
            }
          >
            {t("reject")}
          </Button>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("reason")}</legend>
          {[...reasons, "other"].map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-2 rounded-md border border-line px-3">
              <input type="radio" name={`reason-${p.id}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--primary)]" />
              {r === "other" ? t("otherReason") : r}
            </label>
          ))}
          {reason === "other" && <Input aria-label={t("otherReason")} value={other} maxLength={200} onChange={(e) => setOther(e.target.value)} />}
        </fieldset>
      </Dialog>
    </Card>
  );
}
