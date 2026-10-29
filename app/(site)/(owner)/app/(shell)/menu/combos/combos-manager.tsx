"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import type { Locale } from "@/lib/i18n/config";
import { tx, type I18nText } from "@/lib/menu/types";
import { publicImageUrl } from "@/lib/storage";
import { deleteCombo, saveCombo, type ComboInput } from "../actions";
import { Photos } from "../items/[id]/item-editor";

type Combo = {
  id: string;
  name: I18nText;
  description: I18nText;
  price: number;
  photo: string | null;
  item_ids: string[];
  is_visible: boolean;
  is_sold_out: boolean;
};
type Category = { id: string; name: I18nText; items: { id: string; name: I18nText }[] };

const blank = (): ComboInput => ({ name: { fr: "", ar: "" }, description: { fr: "", ar: "" }, price: "", photo: null, itemIds: [], isVisible: true, isSoldOut: false });

export function CombosManager({ combos, categories, editable, locale }: { combos: Combo[]; categories: Category[]; editable: boolean; locale: Locale }) {
  const t = useTranslations("menuAdmin.combos");
  const tr = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = React.useState<ComboInput | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const itemName = new Map(categories.flatMap((c) => c.items.map((i) => [i.id, tx(i.name, locale)] as const)));

  const open = (c?: Combo) => {
    setError(null);
    setEditing(
      c
        ? {
            id: c.id,
            name: { fr: c.name.fr ?? "", ar: c.name.ar ?? "" },
            description: { fr: c.description.fr ?? "", ar: c.description.ar ?? "" },
            price: String(c.price),
            photo: c.photo,
            itemIds: c.item_ids,
            isVisible: c.is_visible,
            isSoldOut: c.is_sold_out,
          }
        : blank(),
    );
  };

  function save() {
    if (!editing) return;
    start(async () => {
      const r = await saveCombo(editing);
      if (!r.ok) return setError(Object.values(r.fieldErrors ?? {})[0] ?? r.error);
      setEditing(null);
      toast(t("saved"));
      router.refresh();
    });
  }

  const set = (patch: Partial<ComboInput>) => setEditing((e) => (e ? { ...e, ...patch } : e));
  const name = editing?.name as { fr: string; ar: string } | undefined;
  const desc = editing?.description as { fr: string; ar: string } | undefined;

  return (
    <div className="flex flex-col gap-3">
      {editable && (
        <Button className="self-start" onClick={() => open()}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      )}
      {combos.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {combos.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center gap-3 p-3">
                <span className="size-16 shrink-0 overflow-hidden rounded-md bg-sand">
                  {c.photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- owner-side thumbnail
                    <img src={publicImageUrl(c.photo) ?? ""} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{tx(c.name, locale)}</span>
                  <span className="truncate text-sm text-muted">{c.item_ids.map((i) => itemName.get(i)).filter(Boolean).join(" + ")}</span>
                  <span className="flex items-center gap-2 text-sm">
                    <Price amount={c.price} className="font-bold" />
                    {!c.is_visible && <Badge>{t("hidden")}</Badge>}
                    {c.is_sold_out && <Badge>{t("soldOut")}</Badge>}
                  </span>
                </span>
                {editable && (
                  <Button variant="ghost" size="icon" aria-label={t("edit", { name: tx(c.name, locale) })} onClick={() => open(c)}>
                    <Pencil aria-hidden />
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing?.id ? t("editTitle") : t("newTitle")}
        footer={
          <div className="flex gap-2">
            {editing?.id && (
              <Button
                variant="danger-ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteCombo(editing.id!);
                    if (!r.ok) return setError(r.error);
                    setEditing(null);
                    toast(t("deleted"));
                    router.refresh();
                  })
                }
              >
                <Trash2 aria-hidden />
                {t("delete")}
              </Button>
            )}
            <Button className="flex-1" size="lg" loading={pending} onClick={save}>
              {t("save")}
            </Button>
          </div>
        }
      >
        {editing && name && desc && (
          <div className="flex flex-col gap-4">
            <FormAlert>{error && tr(error as never)}</FormAlert>
            <Field id="combo-name-fr" label={t("nameFr")}>
              <Input id="combo-name-fr" value={name.fr} maxLength={80} placeholder={t("namePlaceholder")} onChange={(e) => set({ name: { ...name, fr: e.target.value } })} />
            </Field>
            <Field id="combo-name-ar" label={t("nameAr")}>
              <Input id="combo-name-ar" dir="rtl" lang="ar" value={name.ar} maxLength={80} onChange={(e) => set({ name: { ...name, ar: e.target.value } })} />
            </Field>
            <Field id="combo-price" label={t("price")}>
              <Input id="combo-price" inputMode="numeric" dir="ltr" className="w-40" value={String(editing.price ?? "")} onChange={(e) => set({ price: e.target.value })} />
            </Field>
            <Field id="combo-desc-fr" label={t("descriptionFr")}>
              <Input id="combo-desc-fr" value={desc.fr} maxLength={300} onChange={(e) => set({ description: { ...desc, fr: e.target.value } })} />
            </Field>
            <Field id="combo-desc-ar" label={t("descriptionAr")}>
              <Input id="combo-desc-ar" dir="rtl" lang="ar" value={desc.ar} maxLength={300} onChange={(e) => set({ description: { ...desc, ar: e.target.value } })} />
            </Field>
            <Photos max={1} photos={editing.photo ? [editing.photo] : []} onChange={(p) => set({ photo: p[0] ?? null })} onError={setError} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">{t("contains")}</legend>
              <p className="text-sm text-muted">{t("containsHint")}</p>
              {categories.map((c) => (
                <div key={c.id} className="flex flex-col">
                  <p className="pt-2 text-xs font-bold tracking-wide text-muted uppercase">{tx(c.name, locale)}</p>
                  {c.items.map((i) => {
                    const checked = editing.itemIds.includes(i.id);
                    return (
                      <label key={i.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line text-sm last:border-0">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--primary)]"
                          checked={checked}
                          onChange={() => set({ itemIds: checked ? editing.itemIds.filter((x) => x !== i.id) : [...editing.itemIds, i.id] })}
                        />
                        {tx(i.name, locale)}
                      </label>
                    );
                  })}
                </div>
              ))}
            </fieldset>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="font-medium">{t("visible")}</span>
              <Toggle checked={editing.isVisible} onCheckedChange={(v) => set({ isVisible: v })} aria-label={t("visible")} />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="font-medium">{t("soldOut")}</span>
              <Toggle checked={editing.isSoldOut} onCheckedChange={(v) => set({ isSoldOut: v })} aria-label={t("soldOut")} />
            </label>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
