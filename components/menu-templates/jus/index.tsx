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

// Fruit colors, all dark-text safe.
const FRUITS = ["#FFD23F", "#FF9F5A", "#9BE564", "#FF8FB1", "#7FD8F5", "#C9A7FF"];

function Header({ restaurant, labels, open, tableLabel, logoUrl, onInfo, langSwitch }: HeaderProps) {
  return (
    <header className="relative overflow-hidden px-4 pt-3 pb-6">
      <div className="absolute -end-10 -top-16 size-48 rounded-full bg-[#FFD23F]" aria-hidden />
      <div className="absolute -start-12 top-24 size-32 rounded-full bg-[#9BE564]" aria-hidden />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <TableChip label={tableLabel} className="bg-m-fg text-m-bg" />
          <div className="ms-auto flex items-center gap-1">
            {langSwitch}
            <InfoButton onClick={onInfo} labels={labels} className="bg-white/80" />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-4">
          <LogoMark url={logoUrl} name={restaurant.name} className="size-16 ring-4 ring-white" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight">{restaurant.name}</h1>
            {restaurant.commune && <p className="text-sm text-m-muted">{restaurant.commune}</p>}
          </div>
        </div>
        <OpenStatus open={open} labels={labels} className="self-start bg-white/80" />
      </div>
    </header>
  );
}

function ItemCard({ item, name, lang, labels, onOpen, hideCurrency, index }: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ background: FRUITS[index % FRUITS.length] }}
      className={cx("flex min-h-40 flex-col justify-between gap-2 rounded-[22px] p-3 text-start text-[#1f1f1f]", item.is_sold_out && "opacity-55 grayscale")}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="font-display text-lg leading-tight">{name}</span>
        <ItemPhoto path={item.photos[0]} name={name} sizes="56px" className="size-14 shrink-0 rounded-full ring-2 ring-white/70" placeholderClassName="bg-white/50 text-[#1f1f1f]" />
      </span>
      <TagBadges tags={item.tags} labels={labels} tone="solid" />
      <span className="flex items-center justify-between">
        {item.is_sold_out ? (
          <SoldOutBadge label={labels.soldOut} />
        ) : (
          <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="font-display text-xl" />
        )}
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#FFFDF5",
    "--m-surface": "#FFFFFF",
    "--m-fg": "#232323",
    "--m-muted": "#5C5C5C",
    "--m-line": "#EDE4CC",
    "--m-accent": "#232323",
    "--m-on-accent": "#FFD23F",
    "--m-price": "#232323",
    "--m-radius": "22px",
    "--m-display": '"Menu jus"',
  } as React.CSSProperties,
  listClass: "grid grid-cols-2 gap-3",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} photoClassName="rounded-[22px]" />,
};

export default function JusMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
