"use client";

import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { InfoButton, LogoMark, OpenStatus, TableChip } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { HeaderProps, ItemCardProps, TemplateParts } from "@/components/menu/template-types";
import { cx } from "@/lib/utils/cx";

const TILE = ["#FBE3EA", "#DDF3EC"];

function Header({ restaurant, labels, open, tableLabel, logoUrl, onInfo, langSwitch }: HeaderProps) {
  return (
    <header className="mx-3 mt-3 flex flex-col items-center gap-2 rounded-[28px] bg-[#FBE3EA] px-4 pt-3 pb-5 text-center">
      <div className="flex w-full items-center justify-between">
        <TableChip label={tableLabel} className="bg-m-surface" />
        <div className="ms-auto flex items-center gap-1">
          {langSwitch}
          <InfoButton onClick={onInfo} labels={labels} className="bg-m-surface" />
        </div>
      </div>
      <LogoMark url={logoUrl} name={restaurant.name} className="size-20 shadow-sm" />
      <h1 className="font-display text-3xl">{restaurant.name}</h1>
      {restaurant.commune && <p className="-mt-1 text-sm text-m-muted">{restaurant.commune}</p>}
      <OpenStatus open={open} labels={labels} className="bg-m-surface" />
    </header>
  );
}

function ItemCard({ item, name, lang, labels, onOpen, hideCurrency, index }: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ background: TILE[index % 2] }}
      className={cx("flex flex-col items-center gap-2 rounded-[24px] p-3 text-center", item.is_sold_out && "opacity-50 grayscale")}
    >
      <ItemPhoto path={item.photos[0]} name={name} sizes="160px" className="aspect-square w-full rounded-[18px]" placeholderClassName="bg-white/60" />
      <span className="font-display leading-tight">{name}</span>
      <TagBadges tags={item.tags} labels={labels} className="justify-center" />
      {item.is_sold_out ? (
        <SoldOutBadge label={labels.soldOut} />
      ) : (
        <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="rounded-full bg-m-surface px-3 py-0.5 text-sm font-bold text-m-price" />
      )}
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#FFF8FA",
    "--m-surface": "#FFFFFF",
    "--m-fg": "#4A2B36",
    "--m-muted": "#7E5966",
    "--m-line": "#F3D3DD",
    "--m-accent": "#C2557A",
    "--m-on-accent": "#FFFFFF",
    "--m-price": "#4A2B36",
    "--m-radius": "24px",
    "--m-display": '"Menu patisserie"',
  } as React.CSSProperties,
  hideCurrencyOnItems: true,
  listClass: "grid grid-cols-2 gap-3",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} photoClassName="rounded-[24px]" />,
};

export default function PatisserieMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
