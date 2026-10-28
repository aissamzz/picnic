"use client";

import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { InfoButton, LogoMark, OpenStatus, TableChip } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { HeaderProps, ItemCardProps, SectionHeaderProps, TemplateParts } from "@/components/menu/template-types";
import { cx } from "@/lib/utils/cx";

function Header({ restaurant, labels, open, tableLabel, logoUrl, onInfo, langSwitch }: HeaderProps) {
  return (
    <header className="border-b border-m-fg px-4 pt-3 pb-5">
      <div className="flex items-center justify-between">
        <TableChip label={tableLabel} className="bg-m-fg text-m-bg" />
        <div className="ms-auto flex items-center gap-1">
          {langSwitch}
          <InfoButton onClick={onInfo} labels={labels} className="border border-m-fg" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 pt-6">
        <h1 className="font-display text-4xl leading-none tracking-tight lowercase">{restaurant.name}</h1>
        <LogoMark url={logoUrl} name={restaurant.name} className="size-12 grayscale" />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-m-muted">
        <span>{restaurant.commune}</span>
        <OpenStatus open={open} labels={labels} className="-me-2.5" />
      </div>
    </header>
  );
}

function SectionHeader({ title, count, index }: SectionHeaderProps) {
  return (
    <h2 className="font-display mb-3 flex items-baseline justify-between border-b border-m-fg pb-1 text-lg">
      <span>
        <bdi dir="ltr" className="me-2 text-m-muted tabular">
          {String(index + 1).padStart(2, "0")}
        </bdi>
        {title}
      </span>
      <span className="text-sm text-m-muted tabular">{count}</span>
    </h2>
  );
}

function ItemCard({ item, name, lang, labels, onOpen, hideCurrency, index }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex flex-col bg-m-surface text-start", item.is_sold_out && "opacity-45")}>
      <span className="relative">
        <ItemPhoto path={item.photos[0]} name={name} sizes="(max-width: 640px) 50vw, 256px" className="aspect-square w-full grayscale" placeholderClassName="bg-[#e9e9e9] text-[#bdbdbd]" />
        <bdi dir="ltr" className="font-display absolute start-2 top-1 text-3xl text-m-fg/80 tabular">
          {String(index + 1).padStart(2, "0")}
        </bdi>
      </span>
      <span className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="font-display leading-tight">{name}</span>
        <TagBadges tags={item.tags} labels={labels} />
        <span className="mt-auto flex items-center justify-between gap-1">
          {item.is_sold_out ? <SoldOutBadge label={labels.soldOut} /> : <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="text-sm font-semibold" />}
        </span>
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#FFFFFF",
    "--m-surface": "#F4F4F4",
    "--m-fg": "#111111",
    "--m-muted": "#575757",
    "--m-line": "#E3E3E3",
    "--m-accent": "#111111",
    "--m-on-accent": "#FFFFFF",
    "--m-price": "#111111",
    "--m-radius": "0px",
    "--m-display": '"Menu coffee"',
  } as React.CSSProperties,
  listClass: "grid grid-cols-2 gap-px bg-m-line",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} variant="square" />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} photoClassName="grayscale" />,
  SectionHeader,
};

export default function CoffeeMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
