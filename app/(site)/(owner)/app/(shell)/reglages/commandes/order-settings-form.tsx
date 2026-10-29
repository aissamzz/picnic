"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PhoneInput, toNationalNumber } from "@/components/ui/phone-input";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { saveOrderSettings } from "./actions";

type Initial = {
  orders_enabled: boolean;
  whatsapp_order_phone: string | null;
  delivery_enabled: boolean;
  takeaway_enabled: boolean;
  min_order: number;
  eta_label: string | null;
  zones: { id: string; name: string; fee: number }[];
};

export function OrderSettingsForm({ initial, editable, orderUrl }: { initial: Initial; editable: boolean; orderUrl: string }) {
  const t = useTranslations("owner.orders");
  const tr = useTranslations();
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initial.orders_enabled);
  const [whatsapp, setWhatsapp] = React.useState(toNationalNumber(initial.whatsapp_order_phone ?? ""));
  const [delivery, setDelivery] = React.useState(initial.delivery_enabled);
  const [takeaway, setTakeaway] = React.useState(initial.takeaway_enabled);
  const [zones, setZones] = React.useState<{ id?: string; name: string; fee: string }[]>(initial.zones.map((z) => ({ ...z, fee: String(z.fee) })));
  const [minOrder, setMinOrder] = React.useState(String(initial.min_order));
  const [eta, setEta] = React.useState(initial.eta_label ?? "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const e = (k: string) => (errors[k] ? tr(errors[k] as never) : undefined);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        start(async () => {
          setErrors({});
          setFormError(null);
          const r = await saveOrderSettings({ enabled, whatsapp, delivery, takeaway, zones, minOrder, eta });
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            if (!r.fieldErrors || !Object.keys(r.fieldErrors).length) setFormError(r.error);
            return;
          }
          toast(t("saved"));
          router.refresh();
        });
      }}
    >
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-4">
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="font-semibold">{t("enabled")}</span>
            <Toggle checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <Field id="whatsapp" label={t("whatsapp")} hint={t("whatsappHint")} error={e("whatsapp")}>
            <PhoneInput id="whatsapp" value={whatsapp} onChange={setWhatsapp} aria-invalid={!!errors.whatsapp} aria-describedby={errors.whatsapp ? "whatsapp-error" : "whatsapp-hint"} />
          </Field>
        </Card>

        <Card className="flex flex-col gap-2 p-4">
          <h2 className="font-semibold">{t("modes")}</h2>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>{t("delivery")}</span>
            <Toggle checked={delivery} onCheckedChange={setDelivery} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span>{t("takeaway")}</span>
            <Toggle checked={takeaway} onCheckedChange={setTakeaway} />
          </label>
          {errors.delivery && (
            <p role="alert" className="text-sm text-danger">
              {e("delivery")}
            </p>
          )}
        </Card>

        {delivery && (
          <Card className="flex flex-col gap-3 p-4">
            <div>
              <h2 className="font-semibold">{t("zones")}</h2>
              <p className="text-sm text-muted">{t("zonesHint")}</p>
            </div>
            {zones.map((z, i) => (
              <div key={z.id ?? `new-${i}`} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
                <Field id={`zone-${i}-name`} label={t("zoneName")} error={e(`zones.${i}.name`)}>
                  <Input id={`zone-${i}-name`} value={z.name} onChange={(ev) => setZones((s) => s.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} />
                </Field>
                <Field id={`zone-${i}-fee`} label={t("zoneFee")} error={e(`zones.${i}.fee`)}>
                  <Input
                    id={`zone-${i}-fee`}
                    inputMode="numeric"
                    dir="ltr"
                    className="tabular"
                    value={z.fee}
                    onChange={(ev) => setZones((s) => s.map((x, j) => (j === i ? { ...x, fee: ev.target.value } : x)))}
                  />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label={t("removeZone", { n: i + 1 })} onClick={() => setZones((s) => s.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" className="self-start" onClick={() => setZones((s) => [...s, { name: "", fee: "0" }])}>
              <Plus aria-hidden />
              {t("addZone")}
            </Button>
          </Card>
        )}

        <Card className="grid grid-cols-2 gap-3 p-4">
          <Field id="min-order" label={t("minOrder")} hint={t("minOrderHint")} error={e("minOrder")}>
            <Input id="min-order" inputMode="numeric" dir="ltr" className="tabular" value={minOrder} onChange={(ev) => setMinOrder(ev.target.value)} />
          </Field>
          <Field id="eta" label={t("eta")}>
            <Input id="eta" value={eta} placeholder={t("etaPlaceholder")} onChange={(ev) => setEta(ev.target.value)} />
          </Field>
        </Card>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={orderUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
          <ExternalLink className="size-4" aria-hidden />
          {t("previewLink")}
        </a>
        {editable && (
          <Button type="submit" loading={pending}>
            {t("save")}
          </Button>
        )}
      </div>
    </form>
  );
}
