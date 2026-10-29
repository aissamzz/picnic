"use client";

import * as React from "react";
import { addLine } from "@/lib/menu/cart";
import { tx, type Lang, type MenuItem } from "@/lib/menu/types";
import { formatPrice } from "@/lib/price";
import { cx } from "@/lib/utils/cx";
import { fmt, type MenuLabels } from "../labels";
import { MenuPrice } from "../menu-price";
import { setCart, useCart } from "./cart-store";
import { QtyStepper } from "./stepper";

/** Size, extras, quantity and "Ajouter" inside the item sheet (order links). */
export default function ItemControls({
  item,
  restaurantId,
  lang,
  labels,
  closedNotice,
  onAdded,
}: {
  item: MenuItem;
  restaurantId: string;
  lang: Lang;
  labels: MenuLabels;
  closedNotice: string | null;
  onAdded: () => void;
}) {
  const [cart] = useCart(restaurantId);
  const [variant, setVariant] = React.useState<string | null>(item.variants.length === 1 ? item.variants[0].id : null);
  const [extras, setExtras] = React.useState<string[]>([]);
  const [qty, setQty] = React.useState(1);
  const [error, setError] = React.useState(false);
  const o = labels.order;

  if (item.is_sold_out) return null;
  const base = variant ? (item.variants.find((v) => v.id === variant)?.price ?? 0) : (item.base_price ?? 0);
  const unit = base + extras.reduce((s, id) => s + (item.extras.find((x) => x.id === id)?.price ?? 0), 0);
  const needsVariant = item.variants.length > 0 && !variant;
  const priced = item.variants.length > 0 || item.base_price != null;
  if (!priced) return null;

  return (
    <div className="mt-4 flex flex-col gap-4">
      {item.variants.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
            {labels.variants}
            <span className={cx("rounded-full px-2 py-0.5 text-xs", error && needsVariant ? "bg-[#fdeaea] text-[#b42318]" : "bg-black/5 text-m-muted")}>{o.required}</span>
          </legend>
          {item.variants.map((v) => (
            <label key={v.id} className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-m border px-3", variant === v.id ? "border-m-accent" : "border-m-line")}>
              <input type="radio" name={`variant-${item.id}`} checked={variant === v.id} onChange={() => setVariant(v.id)} className="size-5 accent-[var(--m-accent)]" />
              <span className="flex-1">{tx(v.name, lang)}</span>
              <MenuPrice amount={v.price} lang={lang} className="font-semibold" />
            </label>
          ))}
        </fieldset>
      )}
      {item.extras.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
            {labels.extras}
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-m-muted">{o.optional}</span>
          </legend>
          {item.extras.map((x) => (
            <label key={x.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-m border border-m-line px-3">
              <input
                type="checkbox"
                checked={extras.includes(x.id)}
                onChange={(e) => setExtras((s) => (e.target.checked ? [...s, x.id] : s.filter((i) => i !== x.id)))}
                className="size-5 accent-[var(--m-accent)]"
              />
              <span className="flex-1">{tx(x.name, lang)}</span>
              {x.price > 0 && (
                <span className="text-sm text-m-muted">
                  +<MenuPrice amount={x.price} lang={lang} />
                </span>
              )}
            </label>
          ))}
        </fieldset>
      )}
      {closedNotice ? (
        <p role="status" className="rounded-m bg-black/5 px-3 py-2 text-sm font-medium">
          {closedNotice}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <QtyStepper value={qty} onChange={setQty} labels={o} label={o.quantity} />
          <button
            type="button"
            className="min-h-12 flex-1 rounded-full bg-m-accent px-4 font-bold text-m-on-accent"
            onClick={() => {
              if (needsVariant) return setError(true);
              setCart(restaurantId, addLine(cart, item.id, variant, extras, qty));
              onAdded();
            }}
          >
            {fmt(o.add, { price: formatPrice(unit * qty, lang) })}
          </button>
        </div>
      )}
      {error && needsVariant && (
        <p role="alert" className="text-sm font-semibold text-[#b42318]">
          {o.chooseSize}
        </p>
      )}
    </div>
  );
}
