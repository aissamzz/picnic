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
    <header className="flex flex-col items-center gap-3 px-4 pt-3 pb-5 text-center">
      <div className="flex w-full items-center justify-between">
        <TableChip label={tableLabel} className="bg-m-accent text-m-on-accent" />
        <div className="ms-auto flex items-center gap-1">
          {langSwitch}
          <InfoButton onClick={onInfo} labels={labels} className="border border-m-line" />
        </div>
      </div>
      <LogoMark url={logoUrl} name={restaurant.name} className="size-20 border-2 border-m-accent" />
      <h1 className="font-display text-3xl leading-tight">{restaurant.name}</h1>
      {restaurant.commune && <p className="-mt-2 text-m-muted italic">{restaurant.commune}</p>}
      <OpenStatus open={open} labels={labels} className="bg-m-surface" />
    </header>
  );
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="font-display mb-2 flex items-center gap-3 text-2xl">
      {title}
      <span className="h-px flex-1 bg-m-line" aria-hidden />
    </h2>
  );
}

function ItemCard({ item, name, description, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex w-full items-center gap-3 py-3 text-start", item.is_sold_out && "opacity-50")}>
      <ItemPhoto path={item.photos[0]} name={name} sizes="64px" className="size-14 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg leading-tight">{name}</span>
          <span className="mb-1 min-w-4 flex-1 border-b-2 border-dotted border-m-line" aria-hidden />
          <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="font-semibold text-m-price" />
        </span>
        {description && <span className="line-clamp-2 text-sm text-m-muted">{description}</span>}
        <span className="flex flex-wrap items-center gap-1">
          {item.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
          <TagBadges tags={item.tags} labels={labels} />
        </span>
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#F4EBDD",
    "--m-surface": "#FFFBF4",
    "--m-fg": "#3B2A1E",
    "--m-muted": "#6E5A4A",
    "--m-line": "#DCCBB4",
    "--m-accent": "#8A5A3B",
    "--m-on-accent": "#FFFBF4",
    "--m-price": "#3B2A1E",
    "--m-radius": "18px",
    "--m-display": '"Menu cafe"',
  } as React.CSSProperties,
  hideCurrencyOnItems: true,
  listClass: "flex flex-col divide-y divide-m-line",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} variant="underline" />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} photoClassName="rounded-[24px]" />,
  SectionHeader,
};

export default function CafeMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
