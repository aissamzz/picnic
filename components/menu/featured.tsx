import { Layers, Star } from "lucide-react";
import { tx, type Lang, type MenuCombo, type MenuItem } from "@/lib/menu/types";
import { cx as cn } from "@/lib/utils/cx";
import { ItemPhoto } from "./item-photo";
import type { MenuLabels } from "./labels";
import { itemFromPrice, MenuPrice } from "./menu-price";
import { SoldOutBadge } from "./tag-badges";

/** "Best sellers": the dishes the owner starred, as a swipeable row. */
export function BestSellersRow({
  items,
  lang,
  labels,
  onOpen,
  hideCurrency,
}: {
  items: MenuItem[];
  lang: Lang;
  labels: MenuLabels;
  onOpen: (item: MenuItem) => void;
  hideCurrency: boolean;
}) {
  return (
    <section aria-labelledby="best-sellers-title" className="pt-6">
      <h2 id="best-sellers-title" className="font-display mb-3 flex items-center gap-2 px-4 text-xl font-bold">
        <Star className="size-5 fill-m-accent text-m-accent" aria-hidden />
        {labels.bestSellers}
      </h2>
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((item) => {
          const name = tx(item.name, lang);
          const price = itemFromPrice(item);
          return (
            <li key={item.id} className="w-40 shrink-0 snap-start">
              <button type="button" onClick={() => onOpen(item)} className="flex w-full flex-col gap-1.5 text-start">
                <ItemPhoto path={item.photos[0]} name={name} sizes="160px" className="aspect-[4/3] w-full rounded-m" />
                <span className="line-clamp-2 text-sm leading-snug font-semibold">{name}</span>
                {price != null && <MenuPrice amount={price} lang={lang} hideCurrency={hideCurrency} className="text-sm font-bold text-m-price" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Combos built by the owner: fixed price, with what they contain. */
export function CombosSection({
  combos,
  lang,
  labels,
  onOpen,
}: {
  combos: MenuCombo[];
  lang: Lang;
  labels: MenuLabels;
  onOpen: (combo: MenuCombo) => void;
}) {
  return (
    <section aria-labelledby="combos-title" className="px-4 pt-6">
      <h2 id="combos-title" className="font-display mb-3 flex items-center gap-2 text-xl font-bold">
        <Layers className="size-5 text-m-accent" aria-hidden />
        {labels.combos}
      </h2>
      <div className="flex flex-col gap-3">
        {combos.map((c) => {
          const name = tx(c.name, lang);
          const includes = c.includes.map((n) => tx(n, lang)).filter(Boolean).join(" + ");
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c)}
              className={cn(
                "flex w-full gap-3 rounded-m border-2 border-[color-mix(in_srgb,var(--m-accent)_45%,transparent)] bg-m-surface p-2.5 text-start",
                c.is_sold_out && "opacity-55 grayscale",
              )}
            >
              <ItemPhoto path={c.photo} name={name} sizes="96px" className="size-24 shrink-0 rounded-[calc(var(--m-radius)*0.75)]" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-display text-lg leading-tight font-bold">{name}</span>
                {includes && <span className="line-clamp-2 text-sm text-m-muted">{includes}</span>}
                <span className="mt-auto flex items-center justify-between gap-2">
                  <MenuPrice amount={c.price} lang={lang} className="text-lg font-black text-m-price" />
                  {c.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
