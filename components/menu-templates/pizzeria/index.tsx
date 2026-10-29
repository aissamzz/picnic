"use client";

import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { BannerHeader } from "@/components/menu/header-bits";
import { ItemPhoto } from "@/components/menu/item-photo";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { HeaderProps, ItemCardProps, TemplateParts } from "@/components/menu/template-types";
import { cx as cn } from "@/lib/utils/cx";

function Header(p: HeaderProps) {
  return (
    <BannerHeader {...p} fallbackClass="bg-m-surface" nameClass="uppercase tracking-tight" fallbackNameClass="text-m-fg" statusClass="bg-white/10" />
  );
}

function ItemCard({ item, name, description, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full gap-3 rounded-m bg-m-surface p-2.5 text-start", item.is_sold_out && "opacity-55 grayscale")}
    >
      <ItemPhoto path={item.photos[0]} name={name} sizes="112px" className="size-26 shrink-0 rounded-[10px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <span className="font-display text-base leading-tight">{name}</span>
        {description && <span className="line-clamp-2 text-sm text-m-muted">{description}</span>}
        <TagBadges tags={item.tags} labels={labels} />
        <span className="mt-auto flex items-center justify-between gap-2 pt-1">
          <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="text-lg font-black text-m-price" />
          {item.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
        </span>
      </span>
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#140E0B",
    "--m-surface": "#211813",
    "--m-fg": "#F7EFE5",
    "--m-muted": "#BFAF9E",
    "--m-line": "#3A2C22",
    "--m-accent": "#F2B441",
    "--m-on-accent": "#140E0B",
    "--m-price": "#F2B441",
    "--m-radius": "14px",
    "--m-display": '"Menu pizzeria"',
  } as React.CSSProperties,
  listClass: "flex flex-col gap-3",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} />,
};

export default function PizzeriaMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
