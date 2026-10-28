"use client";

import { EyeOff } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { SortableList } from "@/components/owner/sortable-list";
import { Badge } from "@/components/ui/badge";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import type { Locale } from "@/lib/i18n/config";
import type { AdminItemRow } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { formatPrice } from "@/lib/price";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils/cn";
import { reorderItems, setSoldOut } from "../../../actions";

/** "800 DA" or "1 100 DA – 1 500 DA"; each price isolated so ranges read right in Arabic. */
function PriceLabel({ item, locale, none }: { item: AdminItemRow; locale: Locale; none: string }) {
  const prices = [item.base_price, ...item.variants.map((v) => v.price)].filter((p): p is number => p != null);
  if (!prices.length) return <>{none}</>;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const one = (n: number) => (
    <bdi dir="ltr" className="tabular">
      {formatPrice(n, locale)}
    </bdi>
  );
  return min === max ? one(min) : <>{one(min)} – {one(max)}</>;
}

export function ItemsBoard({ items, editable, locale }: { items: AdminItemRow[]; editable: boolean; locale: Locale }) {
  const t = useTranslations("menuAdmin");
  const tr = useTranslations();
  const uiLocale = useLocale() as Locale;
  const [soldOut, setSoldOutState] = React.useState<Record<string, boolean>>({});
  const isSoldOut = (i: AdminItemRow) => soldOut[i.id] ?? i.is_sold_out;

  function toggle(item: AdminItemRow, available: boolean) {
    const name = tx(item.name, uiLocale);
    const apply = (value: boolean) => {
      setSoldOutState((s) => ({ ...s, [item.id]: value }));
      return setSoldOut(item.id, value).then((r) => {
        if (!r.ok) {
          setSoldOutState((s) => ({ ...s, [item.id]: !value }));
          toast(tr(r.error as never));
        }
        return r;
      });
    };
    apply(!available).then((r) => {
      if (r.ok)
        toastWithUndo(available ? t("soldOutOff", { name }) : t("soldOutOn", { name }), {
          undoLabel: tr("ui.undo"),
          onUndo: () => void apply(available),
        });
    });
  }

  if (items.length === 0) return null;
  return (
    <SortableList
      items={items}
      disabled={!editable}
      className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
      handleLabel={(i) => t("dragHandle", { name: tx(i.name, locale) })}
      onReorder={(ids) => reorderItems(ids).then((r) => !r.ok && toast(tr(r.error as never)))}
      renderItem={(item, handle) => {
        const name = tx(item.name, locale);
        const photo = publicImageUrl(item.photos[0]);
        const available = !isSoldOut(item);
        return (
          <div className={cn("flex items-center gap-2 bg-surface pe-3", !handle && "ps-3")}>
            {handle}
            <Link href={`/app/menu/items/${item.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2">
              <span className="size-12 shrink-0 overflow-hidden rounded-md bg-sand">
                {photo && (
                  // eslint-disable-next-line @next/next/no-img-element -- small owner-side thumbnail
                  <img src={photo} alt="" className="size-full object-cover" loading="lazy" />
                )}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate font-semibold", !available && "text-muted line-through")}>{name}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  <span>
                    <PriceLabel item={item} locale={uiLocale} none={t("noPrice")} />
                  </span>
                  {!item.is_visible && (
                    <Badge>
                      <EyeOff aria-hidden />
                      {t("hidden")}
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
            <label className="flex shrink-0 flex-col items-center gap-0.5 text-[11px] text-muted">
              <Toggle checked={available} onCheckedChange={(v) => toggle(item, v)} disabled={!editable} aria-label={t("availableToggle", { name })} />
              {t("available")}
            </label>
          </div>
        );
      }}
    />
  );
}
