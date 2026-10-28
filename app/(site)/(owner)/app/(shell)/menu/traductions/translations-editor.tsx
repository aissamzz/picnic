"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import type { I18nText } from "@/lib/menu/types";
import { saveTranslations } from "../actions";

export type Row = {
  kind: "category" | "item" | "variant" | "extra";
  id: string;
  field: "name" | "description";
  text: I18nText;
};
const keyOf = (r: Row) => `${r.kind}:${r.id}:${r.field}`;

export function TranslationsEditor({
  rows,
  editable,
}: {
  rows: Row[];
  editable: boolean;
}) {
  const t = useTranslations("menuAdmin.translations");
  const tr = useTranslations();
  const router = useRouter();
  const [onlyMissing, setOnlyMissing] = React.useState(true);
  const [drafts, setDrafts] = React.useState<
    Record<string, { fr: string; ar: string }>
  >({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  React.useEffect(() => setDrafts({}), [rows]);

  const missing = rows.filter((r) => !r.text.fr || !r.text.ar);
  // Keep rows the owner is editing visible even once they are complete.
  const shown = onlyMissing
    ? rows.filter((r) => !r.text.fr || !r.text.ar || drafts[keyOf(r)])
    : rows;
  const value = (r: Row) =>
    drafts[keyOf(r)] ?? { fr: r.text.fr ?? "", ar: r.text.ar ?? "" };
  const changed = rows.filter((r) => {
    const d = drafts[keyOf(r)];
    return d && (d.fr !== (r.text.fr ?? "") || d.ar !== (r.text.ar ?? ""));
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium" aria-live="polite">
          {t("missingCount", { count: missing.length })}
        </p>
        <label className="flex items-center gap-2 text-sm">
          {t("onlyMissing")}
          <Toggle checked={onlyMissing} onCheckedChange={setOnlyMissing} />
        </label>
      </div>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      {shown.length > 0 && (
        <Card className="divide-y divide-line">
          {shown.map((r) => {
            const v = value(r);
            const k = keyOf(r);
            const Control = r.field === "description" ? Textarea : Input;
            const label =
              r.field === "description"
                ? `${t(`kinds.${r.kind}`)} · ${t("description")}`
                : t(`kinds.${r.kind}`);
            return (
              <div key={k} className="flex flex-col gap-2 px-4 py-3">
                <Badge className="self-start">{label}</Badge>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Control
                    aria-label={`${label} · ${t("fr")}`}
                    lang="fr"
                    dir="ltr"
                    rows={2}
                    value={v.fr}
                    disabled={!editable}
                    placeholder={t("fr")}
                    onChange={(
                      e: React.ChangeEvent<
                        HTMLInputElement & HTMLTextAreaElement
                      >,
                    ) =>
                      setDrafts((d) => ({
                        ...d,
                        [k]: { ...v, fr: e.target.value },
                      }))
                    }
                  />
                  <Control
                    aria-label={`${label} · ${t("ar")}`}
                    lang="ar"
                    dir="rtl"
                    rows={2}
                    value={v.ar}
                    disabled={!editable}
                    placeholder={t("ar")}
                    onChange={(
                      e: React.ChangeEvent<
                        HTMLInputElement & HTMLTextAreaElement
                      >,
                    ) =>
                      setDrafts((d) => ({
                        ...d,
                        [k]: { ...v, ar: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}
      {editable && changed.length > 0 && (
        <div className="sticky bottom-16 z-20 -mx-4 flex justify-end border-t border-line bg-sand/95 px-4 py-3 backdrop-blur">
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await saveTranslations(
                  changed.map((row) => ({
                    kind: row.kind,
                    id: row.id,
                    field: row.field,
                    ...value(row),
                  })),
                );
                if (!r.ok) return setError(r.error);
                toast(tr("menuAdmin.saved"));
                router.refresh();
              })
            }
          >
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
