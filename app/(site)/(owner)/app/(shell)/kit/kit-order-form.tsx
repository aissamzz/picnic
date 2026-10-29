"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { PhoneInput, toNationalNumber } from "@/components/ui/phone-input";
import { toast } from "@/components/ui/toast";
import { WILAYAS } from "@/lib/dz/wilayas";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { orderKit } from "../abonnement/actions";

export function KitOrderForm({
  locale,
  kitPrice,
  annualPrice,
  initial,
}: {
  locale: Locale;
  kitPrice: number;
  annualPrice: number;
  initial: { stands: number; posters: number; wilayaCode: number | null; commune: string; address: string; phone: string };
}) {
  const t = useTranslations("kit");
  const tr = useTranslations();
  const router = useRouter();
  const [v, setV] = React.useState({ ...initial, wilayaCode: initial.wilayaCode ? String(initial.wilayaCode) : "", phone: toNationalNumber(initial.phone) });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await orderKit({ ...v, wilayaCode: v.wilayaCode });
          if (!r.ok) return setError(r.error);
          toast(t("ordered"));
          router.refresh();
        });
      }}
    >
      <Card className="grid grid-cols-2 gap-3 p-4">
        <Field id="stands" label={t("stands")}>
          <Input id="stands" type="number" min={1} max={50} inputMode="numeric" value={v.stands} onChange={set("stands")} />
        </Field>
        <Field id="posters" label={t("posters")}>
          <Input id="posters" type="number" min={0} max={20} inputMode="numeric" value={v.posters} onChange={set("posters")} />
        </Field>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <Field id="kit-wilaya" label={t("wilaya")}>
          <Select id="kit-wilaya" value={v.wilayaCode} onChange={set("wilayaCode")} required>
            <option value="" />
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {String(w.code).padStart(2, "0")} · {w[locale]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="kit-commune" label={t("commune")}>
          <Input id="kit-commune" value={v.commune} onChange={set("commune")} />
        </Field>
        <Field id="kit-address" label={t("address")}>
          <Input id="kit-address" value={v.address} onChange={set("address")} required />
        </Field>
        <Field id="kit-phone" label={t("phone")}>
          <PhoneInput id="kit-phone" value={v.phone} onChange={(phone) => setV((s) => ({ ...s, phone }))} />
        </Field>
      </Card>
      <Card className="flex flex-col gap-2 p-4 text-sm">
        <div className="flex justify-between">
          <span>{t("kitPrice")}</span>
          <span className="tabular">{formatPrice(kitPrice, locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("annualPlan")}</span>
          <span className="tabular">{formatPrice(annualPrice, locale)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
          <span>{t("total")}</span>
          <span className="tabular">{formatPrice(kitPrice + annualPrice, locale)}</span>
        </div>
      </Card>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <Button type="submit" size="lg" loading={pending}>
        {t("order")}
      </Button>
    </form>
  );
}
