"use client";

import { BaseItemSheet } from "@/components/menu/base-item-sheet";
import { DefaultTabs } from "@/components/menu/default-tabs";
import { BannerHeader } from "@/components/menu/header-bits";
import { MenuApp, type MenuAppProps } from "@/components/menu/menu-app";
import { CardPrice } from "@/components/menu/menu-price";
import { SoldOutBadge, TagBadges } from "@/components/menu/tag-badges";
import type { HeaderProps, ItemCardProps, SectionHeaderProps, TemplateParts } from "@/components/menu/template-types";
import { cx } from "@/lib/utils/cx";

function Header(p: HeaderProps) {
  return (
    <BannerHeader
      {...p}
      fallbackClass="bg-[#1C1B19]"
      nameClass="tracking-wide"
      fallbackNameClass="text-[#FAF8F3]"
      statusClass=""
      chipClass="border border-m-accent text-m-fg"
      after={<div className="h-px bg-m-accent" aria-hidden />}
    />
  );
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="mb-2 flex items-center gap-3 text-center text-xs font-semibold tracking-[0.3em] text-m-muted uppercase">
      <span className="h-px flex-1 bg-m-accent/60" aria-hidden />
      {title}
      <span className="h-px flex-1 bg-m-accent/60" aria-hidden />
    </h2>
  );
}

function ItemCard({ item, name, description, lang, labels, onOpen, hideCurrency }: ItemCardProps) {
  return (
    <button type="button" onClick={onOpen} className={cx("flex w-full flex-col items-center gap-1 py-5 text-center", item.is_sold_out && "opacity-45")}>
      <span className="font-display text-2xl leading-tight">{name}</span>
      {description && <span className="max-w-xs text-sm text-m-muted italic">{description}</span>}
      <span className="flex flex-wrap justify-center gap-1">
        {item.is_sold_out && <SoldOutBadge label={labels.soldOut} />}
        <TagBadges tags={item.tags} labels={labels} />
      </span>
      <CardPrice item={item} lang={lang} fromLabel={labels.from} hideCurrency={hideCurrency} className="mt-1 text-base font-semibold tracking-wider text-m-price" />
    </button>
  );
}

const parts: TemplateParts = {
  theme: {
    "--m-bg": "#FAF8F3",
    "--m-surface": "#FFFFFF",
    "--m-fg": "#1C1B19",
    "--m-muted": "#655F56",
    "--m-line": "#E3DCCD",
    "--m-accent": "#B08D57",
    "--m-on-accent": "#1C1B19",
    "--m-price": "#7A5C2E",
    "--m-radius": "4px",
    "--m-display": '"Menu gastro"',
  } as React.CSSProperties,
  hideCurrencyOnItems: true,
  listClass: "flex flex-col divide-y divide-[color-mix(in_srgb,var(--m-accent)_45%,transparent)]",
  Header,
  CategoryTabs: (p) => <DefaultTabs {...p} variant="underline" />,
  ItemCard,
  ItemSheet: (p) => <BaseItemSheet {...p} photoClassName="rounded-none" />,
  SectionHeader,
};

export default function GastroMenu(props: MenuAppProps) {
  return <MenuApp {...props} parts={parts} />;
}
