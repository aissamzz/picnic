import type { CSSProperties, ReactNode } from "react";
import type { OpenState } from "@/lib/menu/hours";
import type { Lang, MenuItem, PublicRestaurant } from "@/lib/menu/types";
import type { MenuLabels } from "./labels";

export type HeaderProps = {
  restaurant: PublicRestaurant;
  lang: Lang;
  labels: MenuLabels;
  /** Null until hydrated (computed in the restaurant's time zone on the device). */
  open: OpenState | null;
  tableLabel: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  onInfo: () => void;
  langSwitch: ReactNode;
};

export type TabsProps = {
  categories: { id: string; name: string; count: number }[];
  active: string | null;
  onSelect: (id: string) => void;
  favoritesCount: number;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  labels: MenuLabels;
};

export type ItemCardProps = {
  item: MenuItem;
  name: string;
  description: string;
  lang: Lang;
  labels: MenuLabels;
  onOpen: () => void;
  isFavorite: boolean;
  hideCurrency: boolean;
  /** Position in its list (numbered tiles, color cycles). */
  index: number;
};

export type ItemSheetProps = {
  item: MenuItem;
  lang: Lang;
  labels: MenuLabels;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  hideCurrency: boolean;
  /** Order link: sizes and extras become choices below the sheet, so don't list them. */
  orderable?: boolean;
};

export type SectionHeaderProps = { title: string; count: number; index: number; labels: MenuLabels };
export type DishOfDayProps = { items: MenuItem[]; lang: Lang; labels: MenuLabels; onOpen: (item: MenuItem) => void; hideCurrency: boolean };

/** A diner menu template: same data, its own look. */
export type TemplateParts = {
  /** --m-* theme variables (see .menu-root in globals.css); --m-display names the "Menu {key}" face. */
  theme: CSSProperties;
  rootClass?: string;
  /** Café, Gastro and Pâtisserie show prices without "DA" on item rows. */
  hideCurrencyOnItems?: boolean;
  /** Classes of each section's item container (list vs grid). */
  listClass: string;
  Header: (p: HeaderProps) => ReactNode;
  CategoryTabs: (p: TabsProps) => ReactNode;
  ItemCard: (p: ItemCardProps) => ReactNode;
  ItemSheet: (p: ItemSheetProps) => ReactNode;
  SectionHeader?: (p: SectionHeaderProps) => ReactNode;
  DishOfDay?: (p: DishOfDayProps) => ReactNode;
};
