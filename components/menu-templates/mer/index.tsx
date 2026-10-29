"use client";

import { Anchor } from "lucide-react";
import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { BannerHeader } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { DishOfDayProps, HeaderProps, ItemCardProps, TemplateParts } from "@/components/menu/template-types";
import { tx } from "@/lib/menu/types";
import { cx } from "@/lib/utils/cx";

function Wave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 24" preserveAspectRatio="none" className={cx("block h-6 w-full", className)} aria-hidden>
      <path d="M0 12 C 32 0, 65 0, 97 12 S 162 24, 195 12 S 260 0, 292 12 S 357 24, 390 12 V24 H0 Z" fill="var(--m-bg)" />
    </svg>
  );
}

function Header(p: HeaderProps) {
  return (
    <BannerHeader {...p} fallbackClass="bg-[#13294B]" fallbackNameClass="text-[#F3E9D6]" after={<Wave />} />
  );
}

/** "Arrivage du jour": the dish-of-the-day slot dressed as today's catch. */
function DishOfDay({ items, lang, labels, onOpen, hideCurrency }: DishOfDayProps) {
  return (
    <section aria-label={labels.arrivalOfDay} className="px-4 pt-3">
      <div className="rounded-m bg-[#13294B] p-4 text-[#F3E9D6]">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-widest text-[#E7C89B] uppercase">
          <Anchor className="size-4" aria-hidden />
          {labels.arrivalOfDay}
        </p>
        <ul className="flex flex-col divide-y divide-white/15">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onOpen(item)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-start">
                <span className="font-display text-xl">{tx(item.name, lang)}</span>
                <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="font-bold text-[#E7C89B]" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ItemCard({ item, name, description, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex w-full items-center gap-3 rounded-m bg-m-surface p-3 text-start ring-1 ring-m-line", item.is_sold_out && "opacity-55")}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-xl leading-tight">{name}</span>
        {description && <span className="line-clamp-2 text-sm text-m-muted">{description}</span>}
        <span className="flex flex-wrap items-center gap-1">
          {item.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
          <TagBadges tags={item.tags} labels={labels} />
        </span>
        <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="font-bold text-m-price" />
      </span>
      <ItemPhoto path={item.photos[0]} name={name} sizes="96px" className="size-22 shrink-0 rounded-[12px]" />
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#F3E9D6",
    "--m-surface": "#FFFBF2",
    "--m-fg": "#13294B",
    "--m-muted": "#4D5D75",
    "--m-line": "#E2D4B8",
    "--m-accent": "#13294B",
    "--m-on-accent": "#F3E9D6",
    "--m-price": "#13294B",
    "--m-radius": "16px",
    "--m-display": '"Menu mer"',
  } as React.CSSProperties,
  listClass: "flex flex-col gap-3",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} />,
  DishOfDay,
};

export default function MerMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
