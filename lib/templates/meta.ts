import type { RestaurantType } from "@/lib/dz/restaurant-types";

export const TEMPLATE_KEYS = ["pizzeria", "cafe", "traditionnel", "gastro", "patisserie", "grill", "jus", "mer", "coffee"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Swatches for the template picker (the real templates arrive in phase 3). */
export const TEMPLATE_SWATCH: Record<TemplateKey, { bg: string; fg: string; accent: string; serif?: boolean; round?: boolean }> = {
  pizzeria: { bg: "#140E0B", fg: "#F6F4EF", accent: "#F2B441" },
  cafe: { bg: "#F4EBDD", fg: "#3B2A1E", accent: "#8A5A3B", serif: true, round: true },
  traditionnel: { bg: "#B5523A", fg: "#FFF7EE", accent: "#1C1B19" },
  gastro: { bg: "#FAF8F3", fg: "#1C1B19", accent: "#B08D57", serif: true },
  patisserie: { bg: "#FBE3EA", fg: "#4A2B36", accent: "#9ED9C6", round: true },
  grill: { bg: "#1E1E1E", fg: "#F6F4EF", accent: "#D7372A" },
  jus: { bg: "#FFF4D6", fg: "#2B2B2B", accent: "#FF7A1A", round: true },
  mer: { bg: "#13294B", fg: "#F3E9D6", accent: "#E7C89B", serif: true },
  coffee: { bg: "#F2F2F2", fg: "#111111", accent: "#111111" },
};

/** Mirrors public.default_template_for(). */
export function defaultTemplateFor(type: RestaurantType): TemplateKey {
  const map: Partial<Record<RestaurantType, TemplateKey>> = {
    pizzeria: "pizzeria",
    fast_food: "pizzeria",
    cafe: "cafe",
    restaurant: "traditionnel",
    traditional: "traditionnel",
    gastronomic: "gastro",
    patisserie: "patisserie",
    glacier: "patisserie",
    grill: "grill",
    juice_bar: "jus",
    seafood: "mer",
    coffee_shop: "coffee",
  };
  return map[type] ?? "cafe";
}
