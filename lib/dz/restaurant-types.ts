import type { Enums } from "@/lib/supabase/types";

export const RESTAURANT_TYPES = [
  "restaurant",
  "pizzeria",
  "fast_food",
  "cafe",
  "coffee_shop",
  "traditional",
  "grill",
  "seafood",
  "patisserie",
  "glacier",
  "juice_bar",
  "gastronomic",
  "other",
] as const satisfies readonly Enums<"restaurant_type">[];

export type RestaurantType = (typeof RESTAURANT_TYPES)[number];
