"use client";

import { Flag, FlagOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useReadOnly } from "@/components/owner/read-only";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { formatDzPhone } from "@/lib/utils/phone";

export type OrderRow = {
  id: string;
  public_id: string;
  mode: "delivery" | "takeaway";
  customer_name: string;
  customer_phone: string;
  items: { name: string; qty: number; variant?: string | null }[];
  subtotal: number;
  delivery_fee: number;
  status: "sent" | "flagged_fake";
  created_at: string;
};

export function OrdersLog({ orders }: { orders: OrderRow[] }) {
  const t = useTranslations("owner.stats");
  const readOnly = useReadOnly();
  const tr = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const flag = async (o: OrderRow) => {
    const fake = o.status !== "flagged_fake";
    setBusy(o.id);
    const { error } = await createClient().rpc("flag_order", { p_order_id: o.id, p_fake: fake });
    setBusy(null);
    if (error) return toast(tr("errors.generic"));
    toast(t(fake ? "flaggedToast" : "unflaggedToast"));
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-bold">{t("ordersTitle")}</h2>
      {orders.length === 0 ? (
        <Card className="p-6 text-center text-muted">{t("ordersEmpty")}</Card>
      ) : (
        <>
          <p className="text-sm text-muted">{t("flagHint")}</p>
          <Card className="divide-y divide-line">
            {orders.map((o) => {
              const flagged = o.status === "flagged_fake";
              return (
                <article key={o.id} className="flex flex-col gap-2 p-4" aria-label={`#${o.public_id}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      <span className="tabular">#{o.public_id}</span> · {o.customer_name}{" "}
                      <bdi dir="ltr" className="font-normal text-muted tabular">
                        {formatDzPhone(o.customer_phone)}
                      </bdi>
                    </p>
                    <span className="text-sm text-muted tabular">{format.dateTime(new Date(o.created_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-muted">{o.items.map((i) => `${i.qty} × ${i.name}${i.variant ? ` (${i.variant})` : ""}`).join(", ")}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={flagged ? "font-bold text-muted line-through" : "font-bold"}>{formatPrice(o.subtotal + o.delivery_fee, locale as Locale)}</span>
                      <Badge>{t(`mode.${o.mode}`)}</Badge>
                      {flagged && <Badge tone="danger">{t("flagged")}</Badge>}
                    </div>
                    <Button variant="ghost" size="sm" disabled={readOnly} loading={busy === o.id} onClick={() => void flag(o)} aria-label={`${t(flagged ? "unflag" : "flag")} #${o.public_id}`}>
                      {flagged ? <FlagOff aria-hidden /> : <Flag aria-hidden />}
                      {t(flagged ? "unflag" : "flag")}
                    </Button>
                  </div>
                </article>
              );
            })}
          </Card>
        </>
      )}
    </section>
  );
}
