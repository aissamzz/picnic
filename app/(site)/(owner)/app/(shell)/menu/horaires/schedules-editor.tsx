"use client";

import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { deleteSchedule, saveSchedule } from "../actions";

type Schedule = { id?: string; name: string; starts: string; ends: string; weekdays: number[]; is_active: boolean; categoryIds: string[] };
type Category = { id: string; name: string; scheduleId: string | null };
// Week starts on Saturday in Algeria.
const DAYS = [6, 0, 1, 2, 3, 4, 5];

export function SchedulesEditor({ schedules, categories, editable }: { schedules: Schedule[]; categories: Category[]; editable: boolean }) {
  const t = useTranslations("menuAdmin.schedules");
  const [adding, setAdding] = React.useState(false);
  return (
    <div className="flex flex-col gap-4">
      {schedules.length === 0 && !adding && <EmptyState icon={<CalendarClock />} title={t("empty")} />}
      {schedules.map((s) => (
        <ScheduleCard key={s.id} schedule={s} categories={categories} editable={editable} />
      ))}
      {adding && (
        <ScheduleCard
          schedule={{ name: "", starts: "07:00", ends: "11:00", weekdays: [0, 1, 2, 3, 4, 5, 6], is_active: true, categoryIds: [] }}
          categories={categories}
          editable={editable}
          onDone={() => setAdding(false)}
        />
      )}
      {editable && !adding && (
        <Button variant="soft" className="self-start" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      )}
    </div>
  );
}

function ScheduleCard({ schedule, categories, editable, onDone }: { schedule: Schedule; categories: Category[]; editable: boolean; onDone?: () => void }) {
  const t = useTranslations("menuAdmin.schedules");
  const tr = useTranslations();
  const router = useRouter();
  const [s, setS] = React.useState(schedule);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const days = t.raw("weekdaysShort") as string[];
  const idp = schedule.id ?? "new";

  return (
    <Card className="flex flex-col gap-4 p-4">
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <legend className="sr-only">{s.name || t("add")}</legend>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field id={`${idp}-name`} label={t("name")}>
            <Input id={`${idp}-name`} value={s.name} placeholder={t("namePlaceholder")} onChange={(e) => setS({ ...s, name: e.target.value })} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            {t("active")}
            <Toggle checked={s.is_active} onCheckedChange={(v) => setS({ ...s, is_active: v })} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field id={`${idp}-starts`} label={t("starts")}>
            <Input id={`${idp}-starts`} type="time" dir="ltr" value={s.starts} onChange={(e) => setS({ ...s, starts: e.target.value })} />
          </Field>
          <Field id={`${idp}-ends`} label={t("ends")}>
            <Input id={`${idp}-ends`} type="time" dir="ltr" value={s.ends} onChange={(e) => setS({ ...s, ends: e.target.value })} />
          </Field>
        </div>
        <div role="group" aria-label={t("days")} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("days")}</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <Chip
                key={d}
                selected={s.weekdays.includes(d)}
                className="min-w-12 justify-center px-2"
                onClick={() => setS({ ...s, weekdays: s.weekdays.includes(d) ? s.weekdays.filter((x) => x !== d) : [...s.weekdays, d] })}
              >
                {days[d]}
              </Chip>
            ))}
          </div>
        </div>
        <div role="group" aria-label={t("categories")} className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("categories")}</span>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={s.categoryIds.includes(c.id)}
                onClick={() => setS({ ...s, categoryIds: s.categoryIds.includes(c.id) ? s.categoryIds.filter((x) => x !== c.id) : [...s.categoryIds, c.id] })}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      </fieldset>
      {editable && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="danger-ghost"
            onClick={() =>
              s.id
                ? start(async () => {
                    const r = await deleteSchedule(s.id!);
                    if (!r.ok) return setError(r.error);
                    toast(t("deleted"));
                    router.refresh();
                  })
                : onDone?.()
            }
          >
            <Trash2 aria-hidden />
            {s.id ? t("delete") : tr("ui.cancel")}
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await saveSchedule({ id: s.id, name: s.name, starts: s.starts, ends: s.ends, weekdays: s.weekdays, isActive: s.is_active, categoryIds: s.categoryIds });
                if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
                toast(tr("menuAdmin.saved"));
                onDone?.();
                router.refresh();
              })
            }
          >
            {t("save")}
          </Button>
        </div>
      )}
    </Card>
  );
}
