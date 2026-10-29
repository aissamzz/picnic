"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { activateUntil, addNote, extendTrial, logCall, setSuspended } from "../../actions";

function useAction() {
  const tr = useTranslations();
  const t = useTranslations("admin.detail");
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(tr(r.error as never));
      toast(t("done"));
      after?.();
    });
  return { pending, error, run };
}

export function RestaurantActions({ restaurantId, status }: { restaurantId: string; status: string }) {
  const t = useTranslations("admin.detail");
  const tb = useTranslations("billing.plans");
  const { pending, error, run } = useAction();
  const [days, setDays] = React.useState("7");
  const [until, setUntil] = React.useState("");
  const [plan, setPlan] = React.useState<"monthly" | "semiannual" | "annual">("monthly");
  const [reason, setReason] = React.useState("");
  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="font-semibold">{t("actions")}</h2>
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("extendTrial")} ({t("days")})
          <Input type="number" min={1} max={90} value={days} onChange={(e) => setDays(e.target.value)} className="w-28" />
        </label>
        <Button variant="secondary" loading={pending} onClick={() => run(() => extendTrial(restaurantId, Number(days)))}>
          {t("extend")}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("activate")}
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-44" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("plan")}
          <Select value={plan} onChange={(e) => setPlan(e.target.value as typeof plan)} className="w-36">
            {(["monthly", "semiannual", "annual"] as const).map((p) => (
              <option key={p} value={p}>
                {tb(p)}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="secondary" disabled={!until} loading={pending} onClick={() => run(() => activateUntil(restaurantId, until, plan))}>
          {t("activateBtn")}
        </Button>
      </div>
      {status === "suspended" ? (
        <Button variant="secondary" className="self-start" loading={pending} onClick={() => run(() => setSuspended(restaurantId, false))}>
          {t("unsuspend")}
        </Button>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            {t("suspendReason")}
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button variant="danger" disabled={!reason.trim()} loading={pending} onClick={() => run(() => setSuspended(restaurantId, true, reason), () => setReason(""))}>
            {t("suspend")}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function CallForm({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("admin.detail");
  const { pending, error, run } = useAction();
  const [outcome, setOutcome] = React.useState("interested");
  const [note, setNote] = React.useState("");
  const [next, setNext] = React.useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => logCall(restaurantId, { outcome, note, nextAt: next }), () => {
          setNote("");
          setNext("");
        });
      }}
    >
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t("outcome")}
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-44">
            {(["interested", "call_back", "not_interested", "no_answer"] as const).map((o) => (
              <option key={o} value={o}>
                {t(`outcomes.${o}`)}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("nextCall")}
          <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} className="w-44" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        {t("callNote")}
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Button type="submit" className="self-start" loading={pending}>
        {t("logCall")}
      </Button>
    </form>
  );
}

export function NoteForm({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("admin.detail");
  const { pending, error, run } = useAction();
  const [body, setBody] = React.useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addNote(restaurantId, body), () => setBody(""));
      }}
    >
      <FormAlert>{error}</FormAlert>
      <Textarea aria-label={t("addNote")} rows={2} placeholder={t("notePlaceholder")} value={body} onChange={(e) => setBody(e.target.value)} />
      <Button type="submit" variant="secondary" className="self-start" disabled={!body.trim()} loading={pending}>
        {t("addNote")}
      </Button>
    </form>
  );
}
