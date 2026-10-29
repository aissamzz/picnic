"use client";

import { ChefHat } from "lucide-react";
import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { BannerHeader } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { DishOfDayProps, HeaderProps, ItemCardProps, TemplateParts } from "@/components/menu/template-types";
import { KabyleBand } from "@/components/ui/kabyle-band";
import { tx } from "@/lib/menu/types";
import { cx } from "@/lib/utils/cx";

function Header(p: HeaderProps) {
  return (
    <BannerHeader {...p} fallbackClass="bg-m-accent" fallbackNameClass="text-m-on-accent" after={<KabyleBand />} />
  );
}

function DishOfDay({ items, lang, labels, onOpen, hideCurrency }: DishOfDayProps) {
  return (
    <section aria-label={labels.dishOfDay} className="flex flex-col gap-3 px-4 pt-5">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onOpen(item)} className="overflow-hidden rounded-m bg-m-surface text-start shadow-sm ring-1 ring-m-line">
          {item.photos[0] && <ItemPhoto path={item.photos[0]} name={tx(item.name, lang)} sizes="(max-width: 640px) 100vw, 512px" className="aspect-[2/1] w-full" priority />}
          <span className="flex items-center justify-between gap-3 p-3">
            <span>
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-m-accent px-2.5 py-0.5 text-xs font-bold text-m-on-accent">
                <ChefHat className="size-3.5" aria-hidden />
                {labels.dishOfDay}
              </span>
              <span className="font-display block text-xl">{tx(item.name, lang)}</span>
            </span>
            <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="text-lg font-bold text-m-price" />
          </span>
        </button>
      ))}
    </section>
  );
}

function ItemCard({ item, name, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex flex-col overflow-hidden rounded-m bg-m-surface text-start ring-1 ring-m-line", item.is_sold_out && "opacity-55 grayscale")}>
      <span className="relative">
        <ItemPhoto path={item.photos[0]} name={name} sizes="(max-width: 640px) 50vw, 256px" className="aspect-square w-full" />
        {item.is_sold_out && <SoldOutBadge label={labels.soldOut} className="absolute start-2 top-2" />}
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="font-display leading-tight">{name}</span>
        <TagBadges tags={item.tags} labels={labels} />
        <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="mt-auto font-bold text-m-price" />
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#FBF4EA",
    "--m-surface": "#FFFFFF",
    "--m-fg": "#2B1A12",
    "--m-muted": "#6F5647",
    "--m-line": "#EAD9C6",
    "--m-accent": "#A8462F",
    "--m-on-accent": "#FFF7EE",
    "--m-price": "#A8462F",
    "--m-radius": "14px",
    "--m-display": '"Menu traditionnel"',
  } as React.CSSProperties,
  listClass: "grid grid-cols-2 gap-3",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} variant="square" />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} />,
  DishOfDay,
};

export default function TraditionnelMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
