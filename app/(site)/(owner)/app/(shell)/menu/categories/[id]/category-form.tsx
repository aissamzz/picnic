"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import type { I18nText } from "@/lib/menu/types";
import { deleteCategory, restoreCategory, saveCategory } from "../../actions";

type Props = {
  category: { id: string; name: I18nText; is_visible: boolean; schedule_id: string | null };
  itemsCount: number;
  schedules: { id: string; name: string }[];
  editable: boolean;
};

export function CategoryForm({ category, schedules, editable }: Props) {
  const t = useTranslations("menuAdmin");
  const ti = useTranslations("onboarding.import");
  const tr = useTranslations();
  const router = useRouter();
  const [fr, setFr] = React.useState(category.name.fr ?? "");
  const [ar, setAr] = React.useState(category.name.ar ?? "");
  const [visible, setVisible] = React.useState(category.is_visible);
  const [scheduleId, setScheduleId] = React.useState(category.schedule_id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const name = fr || ar;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await saveCategory({ id: category.id, name: { fr, ar }, isVisible: visible, scheduleId: scheduleId || null });
          if (!r.ok) return setError(r.fieldErrors?.["name.fr"] ?? r.error);
          toast(t("saved"));
          router.push(`/app/menu/categories/${category.id}/items`);
        });
      }}
    >
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <Card className="flex flex-col gap-4 p-4">
        <Field id="cat-fr" label={ti("categoryName")}>
          <Input id="cat-fr" lang="fr" dir="ltr" value={fr} onChange={(e) => setFr(e.target.value)} disabled={!editable} />
        </Field>
        <Field id="cat-ar" label={ti("categoryNameAr")}>
          <Input id="cat-ar" lang="ar" dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} disabled={!editable} />
        </Field>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span className="font-medium">{t("visibleOnMenu")}</span>
          <Toggle checked={visible} onCheckedChange={setVisible} disabled={!editable} />
        </label>
        <Field id="cat-schedule" label={t("schedule")} hint={t("scheduleHint")}>
          <Select id="cat-schedule" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} disabled={!editable} aria-describedby="cat-schedule-hint">
            <option value="">{t("scheduleAlways")}</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>
      {editable && (
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            type="button"
            variant="danger-ghost"
            onClick={() =>
              start(async () => {
                const r = await deleteCategory(category.id);
                if (!r.ok) return setError(r.error);
                toastWithUndo(t("categoryDeleted", { name }), {
                  undoLabel: tr("ui.undo"),
                  onUndo: () => restoreCategory(category.id).then(() => router.refresh()),
                });
                router.push("/app/menu");
              })
            }
          >
            <Trash2 aria-hidden />
            {t("deleteCategory")}
          </Button>
          <Button type="submit" loading={pending}>
            {tr("ui.save")}
          </Button>
        </div>
      )}
    </form>
  );
}
