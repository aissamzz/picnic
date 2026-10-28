import type { Lang } from "@/lib/menu/types";
import { formatPrice } from "@/lib/price";
import { cx as cn } from "@/lib/utils/cx";

/** Price isolated as LTR (reads right inside Arabic). */
export function MenuPrice({ amount, lang, hideCurrency, className }: { amount: number; lang: Lang; hideCurrency?: boolean; className?: string }) {
  return (
    <bdi dir="ltr" className={cn("tabular whitespace-nowrap", className)}>
      {formatPrice(amount, lang, { hideCurrency })}
    </bdi>
  );
}

/** Lowest price of an item (variants included), or null. */
export function itemFromPrice(item: { base_price: number | null; variants: { price: number }[] }): number | null {
  const prices = [item.base_price, ...item.variants.map((v) => v.price)].filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}

/** Item price for cards: "dès 1 100 DA" when sizes differ, else the price. */
export function CardPrice({
  item,
  lang,
  fromLabel,
  hideCurrency,
  className,
}: {
  item: { base_price: number | null; variants: { price: number }[] };
  lang: Lang;
  fromLabel: string;
  hideCurrency?: boolean;
  className?: string;
}) {
  const price = itemFromPrice(item);
  if (price == null) return null;
  const varies = new Set(item.variants.map((v) => v.price)).size > 1;
  if (!varies) return <MenuPrice amount={price} lang={lang} hideCurrency={hideCurrency} className={className} />;
  const [before, after] = fromLabel.split("{price}");
  return (
    <span className={className}>
      <span className="text-[0.75em] font-medium opacity-75">{before}</span>
      <MenuPrice amount={price} lang={lang} hideCurrency={hideCurrency} />
      {after && <span className="text-[0.75em] font-medium opacity-75">{after}</span>}
    </span>
  );
}
