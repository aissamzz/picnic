"use client";

import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { BannerHeader } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { HeaderProps, ItemCardProps, SectionHeaderProps, TemplateParts } from "@/components/menu/template-types";
import { cx } from "@/lib/utils/cx";

function Header(p: HeaderProps) {
  return (
    <BannerHeader {...p} fallbackClass="bg-m-accent" fallbackNameClass="text-m-on-accent" />
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
