import { Heart } from "lucide-react";
import { tx } from "@/lib/menu/types";
import { cx as cn } from "@/lib/utils/cx";
import { ItemPhoto } from "./item-photo";
import { MenuPrice } from "./menu-price";
import { SoldOutBadge, TagBadges } from "./tag-badges";
import type { ItemSheetProps } from "./template-types";

/** Shared item detail body; templates restyle it through props and theme variables. */
export function BaseItemSheet({
  item,
  lang,
  labels,
  isFavorite,
  onToggleFavorite,
  hideCurrency,
  photoClassName,
  priceClassName,
  orderable,
}: ItemSheetProps & { photoClassName?: string; priceClassName?: string }) {
  const name = tx(item.name, lang);
  const description = tx(item.description, lang);
  const showPhoto = item.photos.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {showPhoto && (
        <ItemPhoto path={item.photos[0]} name={name} sizes="(max-width: 640px) 100vw, 512px" className={cn("aspect-[16/10] w-full rounded-m", photoClassName)} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {item.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
        <TagBadges tags={item.tags} labels={labels} />
      </div>
      {description && <p className="text-m-muted">{description}</p>}

      {orderable && !item.is_sold_out ? null : item.variants.length > 0 ? (
        <section aria-label={labels.variants} className="flex flex-col">
          <h3 className="mb-1 text-sm font-semibold text-m-muted">{labels.variants}</h3>
          <ul className="divide-y divide-m-line rounded-m border border-m-line">
            {item.variants.map((v) => (
              <li key={v.id} className="flex min-h-12 items-center justify-between gap-3 px-3">
                <span>{tx(v.name, lang)}</span>
                <MenuPrice amount={v.price} lang={lang} className={cn("font-semibold text-m-price", priceClassName)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        item.base_price != null && <MenuPrice amount={item.base_price} lang={lang} className={cn("text-2xl font-bold text-m-price", priceClassName)} />
      )}

      {item.extras.length > 0 && !(orderable && !item.is_sold_out) && (
        <section aria-label={labels.extras}>
          <h3 className="mb-1 text-sm font-semibold text-m-muted">{labels.extras}</h3>
          <ul className="divide-y divide-m-line rounded-m border border-m-line">
            {item.extras.map((x) => (
              <li key={x.id} className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm">
                <span>{tx(x.name, lang)}</span>
                {x.price > 0 && (
                  <span className="text-m-muted">
                    +<MenuPrice amount={x.price} lang={lang} hideCurrency={hideCurrency} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-m-line px-4 text-sm font-semibold"
      >
        <Heart className={cn("size-4", isFavorite && "fill-m-accent text-m-accent")} aria-hidden />
        {isFavorite ? labels.removeFavorite : labels.addFavorite}
      </button>
    </div>
  );
}
