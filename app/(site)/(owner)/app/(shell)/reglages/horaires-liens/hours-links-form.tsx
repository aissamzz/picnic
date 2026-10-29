"use client";

import { Copy, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { saveHoursAndLinks, type HoursLinksInput } from "./actions";

type Slot = { opens: string; closes: string };
type Links = HoursLinksInput["links"];
type Initial = { hours: { weekday: number; opens: string; closes: string }[]; exceptions: { date: string; note: string }[]; links: Links };

// Restaurant week as people say it here: Saturday first.
const WEEK = [6, 0, 1, 2, 3, 4, 5];
const DEFAULT_SLOT: Slot = { opens: "11:00", closes: "23:00" };

/** 1 Nov 2026 is a Sunday: day names come from Intl in the UI language. */
function dayName(weekday: number, locale: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 10, 1 + weekday)));
}

export function HoursLinksForm({ initial, editable }: { initial: Initial; editable: boolean }) {
  const t = useTranslations("owner.hoursLinks");
  const tr = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [days, setDays] = React.useState<Record<number, Slot[]>>(() => {
    const out: Record<number, Slot[]> = {};
    for (let d = 0; d < 7; d++) out[d] = initial.hours.filter((h) => h.weekday === d).map(({ opens, closes }) => ({ opens, closes }));
    return out;
  });
  const [exceptions, setExceptions] = React.useState(initial.exceptions);
  const [links, setLinks] = React.useState<Links>(initial.links);
  const noHours = WEEK.every((d) => days[d].length === 0);

  const setSlot = (d: number, i: number, patch: Partial<Slot>) =>
    setDays((s) => ({ ...s, [d]: s[d].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const hours = WEEK.flatMap((d) => days[d].map((s) => ({ weekday: d, ...s })));
    start(async () => {
      const r = await saveHoursAndLinks({ hours, exceptions, links });
      if (!r.ok) {
        setFieldErrors(r.fieldErrors ?? {});
        return setError(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
      }
      toast(t("saved"));
      router.refresh();
    });
  }

  const linkField = (key: keyof Links, label: string, hint?: string, placeholder?: string) => (
    <Field id={key} label={label} hint={hint} error={fieldErrors[`links.${key}`] && tr(fieldErrors[`links.${key}`] as never)}>
      <Input
        id={key}
        dir="ltr"
        inputMode="url"
        autoCapitalize="none"
        placeholder={placeholder}
        disabled={!editable}
        value={links[key]}
        aria-describedby={hint ? `${key}-hint` : undefined}
        onChange={(e) => setLinks((l) => ({ ...l, [key]: e.target.value }))}
      />
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormAlert>{error && tr(error as never)}</FormAlert>

      <Card className="flex flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">{t("hoursTitle")}</h2>
            <p className="text-sm text-muted">{noHours ? t("noHours") : t("hoursHint")}</p>
          </div>
        </div>
        <ul className="divide-y divide-line">
          {WEEK.map((d) => {
            const name = dayName(d, locale);
            const open = days[d].length > 0;
            return (
              <li key={d} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">{name}</span>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    {open ? t("open") : t("closed")}
                    <Toggle
                      aria-label={t("openOn", { day: name })}
                      checked={open}
                      disabled={!editable}
                      onCheckedChange={(on) => setDays((s) => ({ ...s, [d]: on ? [{ ...DEFAULT_SLOT }] : [] }))}
                    />
                  </label>
                </div>
                {days[d].map((s, i) => (
                  <div key={i} className="flex items-center gap-2" dir="ltr">
                    <Input
                      type="time"
                      aria-label={`${t("opens")} · ${name}`}
                      className="w-32"
                      disabled={!editable}
                      value={s.opens}
                      onChange={(e) => setSlot(d, i, { opens: e.target.value })}
                    />
                    <span aria-hidden>–</span>
                    <Input
                      type="time"
                      aria-label={`${t("closes")} · ${name}`}
                      className="w-32"
                      disabled={!editable}
                      value={s.closes}
                      onChange={(e) => setSlot(d, i, { closes: e.target.value })}
                    />
                    {i > 0 && (
                      <Button type="button" variant="ghost" size="icon" aria-label={t("removeSlot")} disabled={!editable} onClick={() => setDays((x) => ({ ...x, [d]: x[d].filter((_, j) => j !== i) }))}>
                        <X aria-hidden />
                      </Button>
                    )}
                  </div>
                ))}
                {open && (
                  <div className="flex flex-wrap gap-2">
                    {days[d].length < 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!editable}
                        onClick={() => setDays((x) => ({ ...x, [d]: [...x[d], { opens: "18:00", closes: "23:00" }] }))}
                      >
                        <Plus aria-hidden />
                        {t("addSlot")}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!editable}
                      onClick={() => setDays(() => Object.fromEntries(WEEK.map((w) => [w, days[d].map((x) => ({ ...x }))])))}
                    >
                      <Copy aria-hidden />
                      {t("copyToAll")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">{t("midnightHint")}</p>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">{t("exceptionsTitle")}</h2>
          <p className="text-sm text-muted">{t("exceptionsHint")}</p>
        </div>
        {exceptions.map((e, i) => (
          <div key={i} className="flex items-end gap-2">
            <Field id={`ex-date-${i}`} label={t("exceptionDate")} className="w-40 shrink-0">
              <Input
                id={`ex-date-${i}`}
                type="date"
                dir="ltr"
                disabled={!editable}
                value={e.date}
                onChange={(ev) => setExceptions((l) => l.map((x, j) => (j === i ? { ...x, date: ev.target.value } : x)))}
              />
            </Field>
            <Field id={`ex-note-${i}`} label={t("exceptionNote")} className="flex-1">
              <Input
                id={`ex-note-${i}`}
                maxLength={80}
                disabled={!editable}
                value={e.note}
                onChange={(ev) => setExceptions((l) => l.map((x, j) => (j === i ? { ...x, note: ev.target.value } : x)))}
              />
            </Field>
            <Button type="button" variant="ghost" size="icon" aria-label={t("removeException")} disabled={!editable} onClick={() => setExceptions((l) => l.filter((_, j) => j !== i))}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={!editable}
          onClick={() => setExceptions((l) => [...l, { date: "", note: "" }])}
        >
          <Plus aria-hidden />
          {t("addException")}
        </Button>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="font-semibold">{t("linksTitle")}</h2>
        {linkField("instagram", "Instagram", undefined, "@monrestaurant")}
        {linkField("facebook", "Facebook", undefined, "monrestaurant")}
        {linkField("tiktok", "TikTok", undefined, "@monrestaurant")}
        {linkField("maps_url", t("maps"), t("mapsHint"), "https://maps.app.goo.gl/…")}
        {linkField("google_review_url", t("review"), t("reviewHint"), "https://g.page/r/…")}
      </Card>

      {editable && (
        <div className="sticky bottom-16 z-20 -mx-4 border-t border-line bg-sand/95 px-4 py-3 backdrop-blur">
          <Button type="submit" size="lg" block loading={pending}>
            {t("save")}
          </Button>
        </div>
      )}
    </form>
  );
}
