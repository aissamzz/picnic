"use client";

import { Flame } from "lucide-react";
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
    <BannerHeader
      {...p}
      fallbackClass="bg-gradient-to-br from-[#2A2A2A] to-black"
      nameClass="text-4xl tracking-wide"
      fallbackNameClass="text-white"
      statusClass="bg-white/10"
      after={<div className="h-1 bg-m-accent" aria-hidden />}
    />
  );
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="font-display mb-3 flex items-center gap-2 text-3xl tracking-wide">
      <Flame className="size-6 text-m-accent" aria-hidden />
      {title}
    </h2>
  );
}

function ItemCard({ item, name, description, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("relative -mx-4 block w-[calc(100%+2rem)] overflow-hidden text-start", item.is_sold_out && "grayscale")}>
      <ItemPhoto path={item.photos[0]} name={name} sizes="100vw" className={cx("w-full", item.photos[0] ? "aspect-[16/8]" : "aspect-[16/5]")} placeholderClassName="bg-[#2a2a2a] text-[#3d3d3d]" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" aria-hidden />
      <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-3">
        <span className="min-w-0">
          <TagBadges tags={item.tags} labels={labels} tone="solid" />
          <span className="font-display block text-3xl leading-none tracking-wide text-white">{name}</span>
          {description && <span className="line-clamp-1 text-sm text-white/75">{description}</span>}
        </span>
        {item.is_sold_out ? (
          <SoldOutBadge label={labels.soldOut} />
        ) : (
          <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="shrink-0 rounded-sm bg-m-accent px-2.5 py-1 font-bold text-m-on-accent" />
        )}
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#141414",
    "--m-surface": "#1E1E1E",
    "--m-fg": "#F5F5F5",
    "--m-muted": "#A3A3A3",
    "--m-line": "#2E2E2E",
    "--m-accent": "#C9301F",
    "--m-on-accent": "#FFFFFF",
    "--m-price": "#FF7A5C",
    "--m-radius": "4px",
    "--m-display": '"Menu grill"',
  } as React.CSSProperties,
  listClass: "flex flex-col gap-1",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} variant="square" className="[&_button]:uppercase" />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} />,
  SectionHeader,
};

export default function GrillMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
