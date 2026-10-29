"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import type { FullMenuCategory } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { parsePrice } from "@/lib/price";
import { bumpPrices, savePrices } from "../actions";
import { enqueue, isNetworkError, isOffline } from "@/lib/offline/queue";

/** key: `i:{itemId}` for base prices, `v:{variantId}` for sizes. */
type Drafts = Record<string, string>;

export function PriceEditor({ menu, editable, locale }: { menu: FullMenuCategory[]; editable: boolean; locale: Locale }) {
  const t = useTranslations("menuAdmin.prices");
  const tr = useTranslations();
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<Drafts>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, startSave] = React.useTransition();
  const [bumping, startBump] = React.useTransition();
  const [scope, setScope] = React.useState("");
  const [delta, setDelta] = React.useState("");

  const original = React.useMemo(() => {
    const o: Record<string, number | null> = {};
    for (const c of menu)
      for (const i of c.items) {
        o[`i:${i.id}`] = i.base_price;
        for (const v of i.variants) o[`v:${v.id}`] = v.price;
      }
    return o;
  }, [menu]);
  React.useEffect(() => setDrafts({}), [menu]);

  const changed = Object.entries(drafts).filter(([k, v]) => {
    const p = v.trim() === "" ? null : parsePrice(v);
    return p !== original[k];
  });

  function save() {
    setError(null);
    // "" clears a base price; anything else must parse.
    const read = (key: string, fallback: number | null, clearable: boolean): number | null | "invalid" => {
      const raw = drafts[key];
      if (raw === undefined) return fallback;
      if (raw.trim() === "") return clearable ? null : "invalid";
      return parsePrice(raw) ?? "invalid";
    };
    const keys = new Set(changed.map(([k]) => k));
    const rows: { itemId: string; basePrice: number | null; variants: { id: string; price: number }[] }[] = [];
    for (const c of menu)
      for (const i of c.items) {
        if (!keys.has(`i:${i.id}`) && !i.variants.some((v) => keys.has(`v:${v.id}`))) continue;
        const basePrice = read(`i:${i.id}`, i.base_price, true);
        const variants = i.variants.map((v) => ({ id: v.id, price: read(`v:${v.id}`, v.price, false) }));
        if (basePrice === "invalid" || variants.some((v) => v.price === "invalid" || v.price === null)) return setError("errors.priceInvalid");
        rows.push({ itemId: i.id, basePrice, variants: variants as { id: string; price: number }[] });
      }
    const queue = () => {
      enqueue({ kind: "prices", rows });
      toast(tr("pwa.queue.queued"));
    };
    if (isOffline()) return queue();
    startSave(async () => {
      const r = await savePrices(rows).catch((e) => {
        if (isNetworkError(e)) return null;
        throw e;
      });
      if (!r) return queue();
      if (!r.ok) return setError(r.error);
      toast(t("savedCount"));
      router.refresh();
    });
  }

  const input = (key: string, label: string, value: number | null) => (
    <Input
      aria-label={label}
      inputMode="numeric"
      dir="ltr"
      className="w-28 text-end tabular"
      disabled={!editable}
      value={drafts[key] ?? (value == null ? "" : String(value))}
      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
      aria-invalid={drafts[key] !== undefined && drafts[key].trim() !== "" && parsePrice(drafts[key]) === null}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {editable && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t("bulkTitle")}</h2>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field id="bulk-scope" label={t("bulkScope")}>
              <Select id="bulk-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">{t("bulkAll")}</option>
                {menu.map((c) => (
                  <option key={c.id} value={c.id}>
                    {tx(c.name, locale)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="bulk-delta" label={t("bulkDelta")}>
              <Input id="bulk-delta" inputMode="numeric" dir="ltr" className="tabular" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+50" aria-describedby="bulk-hint" />
            </Field>
          </div>
          <p id="bulk-hint" className="text-sm text-muted">
            {t("bulkHint")}
          </p>
          <Button
            variant="secondary"
            className="self-start"
            loading={bumping}
            disabled={!/^[+-]?\d+$/.test(delta.trim()) || Number(delta) === 0}
            onClick={() =>
              startBump(async () => {
                const r = await bumpPrices({ delta: Number(delta.trim()), categoryId: scope || null });
                if (!r.ok) return setError(r.error);
                toast(t("bulkDone", { count: r.data.count }));
                setDelta("");
                router.refresh();
              })
            }
          >
            {t("bulkApply")}
          </Button>
        </Card>
      )}

      <FormAlert>{error && tr(error as never)}</FormAlert>

      {menu.map((c) => (
        <section key={c.id} aria-labelledby={`p-${c.id}`} className="flex flex-col gap-2">
          <h2 id={`p-${c.id}`} className="font-semibold">
            {tx(c.name, locale)}
          </h2>
          <Card className="divide-y divide-line">
            {c.items.map((i) => {
              const name = tx(i.name, locale);
              return (
                <div key={i.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{name}</span>
                    {(i.base_price != null || i.variants.length === 0) && input(`i:${i.id}`, t("priceOf", { name }), i.base_price)}
                  </div>
                  {i.variants.map((v) => {
                    const vname = `${name} · ${tx(v.name, locale)}`;
                    return (
                      <div key={v.id} className="flex items-center justify-between gap-3 ps-4 text-sm">
                        <span className="text-muted">{tx(v.name, locale)}</span>
                        {input(`v:${v.id}`, t("priceOf", { name: vname }), v.price)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {editable && changed.length > 0 && (
        <div className="sticky bottom-16 z-20 -mx-4 flex items-center gap-3 border-t border-line bg-sand/95 px-4 py-3 backdrop-blur">
          <span className="flex-1 text-sm text-muted" aria-live="polite">
            {t("unsaved", { count: changed.length })}
          </span>
          <Button loading={saving} onClick={save}>
            {t("save")}
          </Button>
        </div>
      )}
    </div>
  );
}
