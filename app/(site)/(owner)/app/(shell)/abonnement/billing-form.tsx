"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { toast } from "@/components/ui/toast";
import { UploadZone } from "@/components/ui/upload-zone";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { PLAN_MONTHS, savingPercent, type Plan } from "@/lib/subscription/state";
import { cn } from "@/lib/utils/cn";
import { submitPayment } from "./actions";

type Method = "baridimob" | "ccp" | "cash";
const PLANS: Plan[] = ["monthly", "semiannual", "annual"];

export function BillingForm({
  reference,
  prices,
  details,
}: {
  reference: string;
  prices: Record<Plan, number>;
  details: { rip: string | null; ccp: string | null; ccpKey: string | null; ccpHolder: string | null };
}) {
  const t = useTranslations("billing");
  const tr = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [plan, setPlan] = React.useState<Plan>("annual");
  const [method, setMethod] = React.useState<Method>("baridimob");
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const copyRow = (label: string, value: string | null) =>
    value ? (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          <p className="truncate font-semibold tabular" dir="ltr">
            {value}
          </p>
        </div>
        <CopyButton value={value} label={t("copy")} copiedLabel={t("copied")} variant="ghost" size="sm" />
      </div>
    ) : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const form = new FormData();
          form.set("plan", plan);
          form.set("method", method);
          if (files[0]) form.set("receipt", files[0]);
          const r = await submitPayment(form);
          if (!r.ok) return setError(r.error);
          toast(t("submitted"));
          setFiles([]);
          router.refresh();
        });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("choosePlan")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {PLANS.map((p) => {
            const saving = savingPercent(prices[p], prices.monthly, p);
            return (
              <label
                key={p}
                className={cn("flex cursor-pointer flex-col gap-1 rounded-lg border-2 bg-surface p-3", plan === p ? "border-primary" : "border-line")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="size-4 accent-[var(--primary)]" />
                    {t(`plans.${p}`)}
                  </span>
                  {saving > 0 && (
                    <bdi dir="ltr" className="rounded-full bg-accent px-2 text-xs font-bold">
                      {t("saving", { percent: saving })}
                    </bdi>
                  )}
                </span>
                <span className="text-lg font-bold tabular">{formatPrice(prices[p], locale)}</span>
                {PLAN_MONTHS[p] > 1 && <span className="text-xs text-muted">{t("perMonth", { price: formatPrice(Math.round(prices[p] / PLAN_MONTHS[p]), locale) })}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("chooseMethod")}</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {(["baridimob", "ccp", "cash"] as const).map((m) => (
            <label key={m} className={cn("flex min-h-12 cursor-pointer items-center justify-center rounded-md border-2 px-2 text-center text-sm font-semibold", method === m ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface")}>
              <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
              {t(`methods.${m}`)}
            </label>
          ))}
        </div>
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm">{t(method === "baridimob" ? "baridimobSteps" : method === "ccp" ? "ccpSteps" : "cashSteps")}</p>
          {method === "baridimob" && (copyRow(t("rip"), details.rip) ?? <p className="text-sm text-muted">{t("notConfigured")}</p>)}
          {method === "ccp" &&
            (details.ccp ? (
              <>
                {copyRow(t("ccpNumber"), details.ccp)}
                {copyRow(t("ccpKey"), details.ccpKey)}
                {details.ccpHolder && copyRow(t("ccpHolder"), details.ccpHolder)}
              </>
            ) : (
              <p className="text-sm text-muted">{t("notConfigured")}</p>
            ))}
          {copyRow(t("reference"), reference)}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">{t("amount")}</span>
            <span className="text-xl font-bold tabular">{formatPrice(prices[plan], locale)}</span>
          </div>
        </Card>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("uploadTitle")}</legend>
        <UploadZone
          id="receipt"
          label={t("receipt")}
          hint={t("receiptHint")}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          maxSize={10 * 1024 * 1024}
          files={files}
          onFilesChange={setFiles}
        />
      </fieldset>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <Button type="submit" size="lg" disabled={!files.length} loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
