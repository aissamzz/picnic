"use client";

import { AlertTriangle, Combine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { applyImport } from "@/lib/actions/ai-import";
import { countItems, findDuplicates, mergeItems, type DraftItem, type I18n, type ImportDraft } from "@/lib/ai/draft";
import { parsePrice } from "@/lib/price";
import { cn } from "@/lib/utils/cn";

const flagged = "border-warning bg-warning-soft focus:border-warning";

/**
 * Editable result of an AI import. Orange = the model wasn't sure or the price
 * couldn't be read; editing a field clears its flag. Nothing reaches the menu
 * until "Ajouter au menu".
 */
export function ImportReview({
  importId,
  initial,
  restartHref,
  onApplied,
  withBottomNav,
}: {
  importId: string;
  initial: ImportDraft;
  restartHref: string;
  /** Called after the dishes are written (navigates on). */
  onApplied: () => void | Promise<void>;
  /** Owner shell pages keep the action bar above the bottom navigation. */
  withBottomNav?: boolean;
}) {
  const t = useTranslations("import.review");
  const tr = useTranslations();
  const router = useRouter();
  const [draft, setDraft] = React.useState(initial);
  const [kept, setKept] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const items = draft.categories.flatMap((c) => c.items);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const dupes = [...findDuplicates(draft)].filter(([k]) => !kept.has(k));
  const dupOf = new Map(dupes);
  const toCheck = items.reduce((n, i) => n + Number(i.check.name) + Number(i.check.price), 0);
  const total = countItems(draft);

  const updateItem = (key: string, f: (i: DraftItem) => DraftItem) =>
    setDraft((d) => ({ ...d, categories: d.categories.map((c) => ({ ...c, items: c.items.map((i) => (i.key === key ? f(i) : i)) })) }));
  const removeItem = (key: string) =>
    setDraft((d) => ({ ...d, categories: d.categories.map((c) => ({ ...c, items: c.items.filter((i) => i.key !== key) })).filter((c) => c.items.length) }));
  const setCategoryName = (key: string, name: I18n) => setDraft((d) => ({ ...d, categories: d.categories.map((c) => (c.key === key ? { ...c, name } : c)) }));
  const label = (n: I18n) => n.fr || n.ar || t("unnamed");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="status">
        <Badge tone={toCheck ? "warning" : "success"}>{t("checkCount", { count: toCheck })}</Badge>
        {draft.partial && (
          <p className="flex basis-full items-start gap-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("partial")}
          </p>
        )}
      </div>
      <FormAlert>{error && tr(error as never)}</FormAlert>

      {total === 0 && <Card className="p-6 text-center text-muted">{t("empty")}</Card>}

      {draft.categories.map((c) => (
        <section key={c.key} aria-label={label(c.name)} className="flex flex-col gap-2">
          <Card className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 bg-sand p-3">
            <LabeledInput label={`${t("category")} · FR`} value={c.name.fr} dir="ltr" lang="fr" onChange={(v) => setCategoryName(c.key, { ...c.name, fr: v })} />
            <LabeledInput label={`${t("category")} · AR`} value={c.name.ar} dir="rtl" lang="ar" onChange={(v) => setCategoryName(c.key, { ...c.name, ar: v })} />
            <Button
              variant="danger-ghost"
              size="icon"
              aria-label={t("removeCategory", { name: label(c.name) })}
              onClick={() => setDraft((d) => ({ ...d, categories: d.categories.filter((x) => x.key !== c.key) }))}
            >
              <Trash2 aria-hidden />
            </Button>
          </Card>

          {c.items.map((i) => {
            const first = dupOf.get(i.key);
            return (
              <Card key={i.key} className="flex flex-col gap-2 p-3" aria-label={label(i.name)}>
                {first && byKey.get(first) && (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-info-soft px-3 py-2 text-sm text-info">
                    <span className="flex-1">{t("duplicate", { name: label(byKey.get(first)!.name) })}</span>
                    <Button size="sm" variant="soft" onClick={() => setDraft((d) => mergeItems(d, first, i.key))}>
                      <Combine aria-hidden />
                      {t("merge")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setKept((s) => new Set(s).add(i.key))}>
                      {t("keepBoth")}
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <LabeledInput
                      label={t("nameFr")}
                      value={i.name.fr}
                      dir="ltr"
                      lang="fr"
                      flagged={i.check.name}
                      flagLabel={t("toCheck")}
                      onChange={(v) => updateItem(i.key, (x) => ({ ...x, name: { ...x.name, fr: v }, check: { ...x.check, name: false } }))}
                    />
                    <LabeledInput
                      label={t("nameAr")}
                      value={i.name.ar}
                      dir="rtl"
                      lang="ar"
                      flagged={i.check.name}
                      flagLabel={t("toCheck")}
                      onChange={(v) => updateItem(i.key, (x) => ({ ...x, name: { ...x.name, ar: v }, check: { ...x.check, name: false } }))}
                    />
                  </div>
                  <Button variant="danger-ghost" size="icon" className="mt-6" aria-label={t("removeItem", { name: label(i.name) })} onClick={() => removeItem(i.key)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>

                {i.variants.length === 0 ? (
                  <div className="w-36">
                    <PriceInput
                      label={t("price")}
                      value={i.price}
                      flagged={i.check.price}
                      flagLabel={t("toCheck")}
                      placeholder={t("noPrice")}
                      onChange={(p) => updateItem(i.key, (x) => ({ ...x, price: p, check: { ...x.check, price: false } }))}
                    />
                  </div>
                ) : (
                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-sm font-medium">{t("sizes")}</legend>
                    {i.variants.map((v, vi) => (
                      <div key={vi} className="grid grid-cols-[1fr_8rem] gap-2">
                        <LabeledInput
                          label={`${t("sizeName")} ${vi + 1}`}
                          value={v.name.fr || v.name.ar}
                          onChange={(val) =>
                            updateItem(i.key, (x) => ({
                              ...x,
                              variants: x.variants.map((y, j) => (j === vi ? { ...y, name: y.name.fr || !y.name.ar ? { ...y.name, fr: val } : { ...y.name, ar: val } } : y)),
                            }))
                          }
                        />
                        <PriceInput
                          label={`${t("sizePrice")} ${vi + 1}`}
                          value={v.price}
                          flagged={i.check.price}
                          flagLabel={t("toCheck")}
                          placeholder={t("noPrice")}
                          onChange={(p) =>
                            updateItem(i.key, (x) => ({ ...x, variants: x.variants.map((y, j) => (j === vi ? { ...y, price: p } : y)), check: { ...x.check, price: false } }))
                          }
                        />
                      </div>
                    ))}
                  </fieldset>
                )}
              </Card>
            );
          })}
        </section>
      ))}

      <div className={cn("sticky -mx-4 flex flex-col gap-1 border-t border-line bg-sand/95 px-4 pt-3 backdrop-blur", withBottomNav ? "bottom-16 pb-3" : "bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))]")}>
        <Button
          size="lg"
          block
          disabled={total === 0}
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await applyImport(importId, draft);
              if (!r.ok) return setError(r.error);
              toast(t("applied", { count: r.data.items }));
              await onApplied();
            })
          }
        >
          {t("apply", { count: total })}
        </Button>
        <Button variant="link" className="min-h-10 self-center text-sm" onClick={() => router.push(restartHref)}>
          {t("restart")}
        </Button>
      </div>
    </div>
  );
}

function useFieldId() {
  return React.useId();
}

function LabeledInput({
  label,
  value,
  onChange,
  flagged: isFlagged,
  flagLabel,
  dir,
  lang,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  flagged?: boolean;
  flagLabel?: string;
  dir?: "rtl" | "ltr";
  lang?: string;
}) {
  const id = useFieldId();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {isFlagged && <span className="rounded-full bg-warning px-1.5 text-[11px] font-semibold text-white">{flagLabel}</span>}
      </label>
      <Input id={id} value={value} dir={dir} lang={lang} maxLength={120} className={cn(isFlagged && flagged)} aria-invalid={isFlagged || undefined} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  flagged: isFlagged,
  flagLabel,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  flagged?: boolean;
  flagLabel?: string;
  placeholder: string;
}) {
  const id = useFieldId();
  const [text, setText] = React.useState(value == null ? "" : String(value));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {isFlagged && <span className="rounded-full bg-warning px-1.5 text-[11px] font-semibold text-white">{flagLabel}</span>}
      </label>
      <Input
        id={id}
        inputMode="numeric"
        dir="ltr"
        className={cn("tabular", isFlagged && flagged)}
        aria-invalid={isFlagged || undefined}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.trim() ? parsePrice(e.target.value) : null);
        }}
      />
    </div>
  );
}
