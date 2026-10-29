"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { saveSettings, type SettingsInput } from "../actions";

const SECTIONS = {
  prices: ["price_monthly", "price_semiannual", "price_annual", "kit_price"],
  trial: ["trial_days", "grace_days"],
  payment: ["baridimob_rip", "ccp_number", "ccp_key", "ccp_holder"],
  codes: ["code_ttl_seconds", "code_max_attempts", "code_requests_per_hour"],
  antifraud: ["waiter_call_cooldown_sec", "block_after_reports"],
  ai: ["ai_imports_per_trial"],
} as const;
type Key = (typeof SECTIONS)[keyof typeof SECTIONS][number];
const TEXT: ReadonlySet<Key> = new Set(["baridimob_rip", "ccp_number", "ccp_key", "ccp_holder"]);

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const t = useTranslations("admin.settings");
  const tr = useTranslations();
  const [values, setValues] = React.useState<Record<Key, string>>(
    () => Object.fromEntries(Object.values(SECTIONS).flat().map((k) => [k, initial[k] == null ? "" : String(initial[k])])) as Record<Key, string>,
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setErrors({});
          setError(null);
          const r = await saveSettings(values as unknown as SettingsInput);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            return setError(r.error);
          }
          toast(t("saved"));
        });
      }}
    >
      <FormAlert>{error && tr(error as never)}</FormAlert>
      {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((section) => (
        <Card key={section} className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t(`sections.${section}`)}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {SECTIONS[section].map((k) => (
              <Field key={k} id={k} label={t(`fields.${k}`)} error={errors[k] ? tr(errors[k] as never) : undefined}>
                <Input
                  id={k}
                  dir="ltr"
                  inputMode={TEXT.has(k) ? undefined : "numeric"}
                  className={TEXT.has(k) ? undefined : "tabular"}
                  value={values[k]}
                  aria-invalid={!!errors[k]}
                  onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        </Card>
      ))}
      <Button type="submit" size="lg" className="self-start" loading={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
