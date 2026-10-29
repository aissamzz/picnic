export type Lang = "fr" | "ar";
export type I18nText = { fr?: string; ar?: string };
export type ItemTag = "new" | "spicy" | "vegetarian" | "best_seller" | "dish_of_day";

export type MenuItem = {
  id: string;
  name: I18nText;
  description: I18nText;
  base_price: number | null;
  photos: string[];
  tags: ItemTag[];
  is_sold_out: boolean;
  variants: { id: string; name: I18nText; price: number }[];
  extras: { id: string; name: I18nText; price: number }[];
};

export type MenuCategory = {
  id: string;
  name: I18nText;
  icon: string | null;
  schedule_id: string | null;
  items: MenuItem[];
};

/** A fixed-price combo built by the owner (e.g. burger + fries + drink). */
export type MenuCombo = {
  id: string;
  name: I18nText;
  description: I18nText;
  price: number;
  photo: string | null;
  is_sold_out: boolean;
  /** Names of the dishes it contains, in order. */
  includes: I18nText[];
};

/** A combo seen as a dish (cart, item sheet): fixed price, no sizes or extras. */
export function comboAsItem(c: MenuCombo): MenuItem {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    base_price: c.price,
    photos: c.photo ? [c.photo] : [],
    tags: [],
    is_sold_out: c.is_sold_out,
    variants: [],
    extras: [],
  };
}

export type OpeningHour = { weekday: number; opens: string; closes: string };
export type OpeningException = { date: string; closed: boolean; note: string | null };
export type MenuSchedule = { id: string; starts: string; ends: string; weekdays: number[] };

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  type: string;
  wilaya_code: number | null;
  /** Added server-side by RenderMenu (keeps the wilaya list out of the bundle). */
  wilaya_name?: string | null;
  commune: string | null;
  address: string | null;
  logo_path: string | null;
  cover_path: string | null;
  template_key: string;
  primary_color: string | null;
  default_locale: Lang;
  enabled_locales: Lang[];
  timezone: string;
  status: string;
  is_paused: boolean;
  show_powered_by: boolean;
  ordering_available: boolean;
  whatsapp_order_phone: string | null;
  delivery_enabled: boolean;
  takeaway_enabled: boolean;
  min_order: number;
  eta_label: string | null;
  updated_at: string;
};

export type PublicMenu = {
  restaurant: PublicRestaurant;
  social: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    maps_url: string | null;
    google_review_url: string | null;
  } | null;
  hours: OpeningHour[];
  exceptions: OpeningException[];
  schedules: MenuSchedule[];
  delivery_zones: { id: string; name: string; fee: number }[];
  tables: { id: string; code: string; label: string }[];
  categories: MenuCategory[];
  /** Older cached payloads have none. */
  combos?: MenuCombo[];
};

export type MenuMode = "table" | "order";

/** Text in `lang`, falling back to the other language. */
export function tx(text: I18nText | null | undefined, lang: Lang): string {
  return text?.[lang] || text?.fr || text?.ar || "";
}
