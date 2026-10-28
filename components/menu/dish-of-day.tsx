import { ChefHat } from "lucide-react";
import { tx } from "@/lib/menu/types";
import { ItemPhoto } from "./item-photo";
import { itemFromPrice, MenuPrice } from "./menu-price";
import type { DishOfDayProps } from "./template-types";

/** "Plat du jour" slot at the top of the menu. */
export function DefaultDishOfDay({ items, lang, labels, onOpen, hideCurrency, title }: DishOfDayProps & { title?: string }) {
  return (
    <section aria-label={title ?? labels.dishOfDay} className="flex flex-col gap-2 px-4 pt-4">
      {items.map((item) => {
        const name = tx(item.name, lang);
        const price = itemFromPrice(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="flex items-center gap-3 rounded-m border-2 border-m-accent bg-m-surface p-3 text-start"
          >
            <ItemPhoto path={item.photos[0]} name={name} sizes="80px" className="size-16 shrink-0 rounded-[calc(var(--m-radius)*0.75)]" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-xs font-bold tracking-wide text-m-accent uppercase">
                <ChefHat className="size-4" aria-hidden />
                {title ?? labels.dishOfDay}
              </span>
              <span className="font-display block truncate text-lg font-bold">{name}</span>
            </span>
            {price != null && <MenuPrice amount={price} lang={lang} hideCurrency={hideCurrency} className="font-bold text-m-price" />}
          </button>
        );
      })}
    </section>
  );
}
