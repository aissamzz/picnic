import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { I18nText, ItemTag } from "./types";

export type AdminCategory = {
  id: string;
  name: I18nText;
  is_visible: boolean;
  schedule_id: string | null;
  position: number;
  itemsCount: number;
  soldOutCount: number;
};

/** Categories of a restaurant with item and sold-out counts. */
export async function adminCategories(restaurantId: string): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, is_visible, schedule_id, position, items(id, is_sold_out, deleted_at)")
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("position")
    .order("created_at");
  return (data ?? []).map((c) => {
    const items = c.items.filter((i) => !i.deleted_at);
    return {
      id: c.id,
      name: c.name as I18nText,
      is_visible: c.is_visible,
      schedule_id: c.schedule_id,
      position: c.position,
      itemsCount: items.length,
      soldOutCount: items.filter((i) => i.is_sold_out).length,
    };
  });
}

export type AdminItemRow = {
  id: string;
  name: I18nText;
  base_price: number | null;
  photos: string[];
  is_sold_out: boolean;
  is_visible: boolean;
  tags: ItemTag[];
  variants: { price: number }[];
};

export async function adminCategoryItems(restaurantId: string, categoryId: string) {
  const supabase = await createClient();
  const [{ data: category }, { data: items }] = await Promise.all([
    supabase.from("categories").select("id, name, is_visible, schedule_id").eq("id", categoryId).eq("restaurant_id", restaurantId).is("deleted_at", null).maybeSingle(),
    supabase
      .from("items")
      .select("id, name, base_price, photos, is_sold_out, is_visible, tags, item_variants(price)")
      .eq("restaurant_id", restaurantId)
      .eq("category_id", categoryId)
      .is("deleted_at", null)
      .order("position")
      .order("created_at"),
  ]);
  if (!category) return null;
  return {
    category: { ...category, name: category.name as I18nText },
    items: (items ?? []).map(({ item_variants, ...i }) => ({ ...i, name: i.name as I18nText, variants: item_variants })) as AdminItemRow[],
  };
}

export async function adminItem(restaurantId: string, itemId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, category_id, name, description, base_price, photos, tags, is_sold_out, is_visible, item_variants(name, price, position), item_extras(name, price, position)")
    .eq("id", itemId)
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const byPos = <T extends { position: number }>(a: T[]) => [...a].sort((x, y) => x.position - y.position);
  return {
    id: data.id,
    categoryId: data.category_id,
    name: data.name as I18nText,
    description: data.description as I18nText,
    basePrice: data.base_price,
    photos: data.photos,
    tags: data.tags as ItemTag[],
    isSoldOut: data.is_sold_out,
    isVisible: data.is_visible,
    variants: byPos(data.item_variants).map((v) => ({ name: v.name as I18nText, price: v.price })),
    extras: byPos(data.item_extras).map((x) => ({ name: x.name as I18nText, price: x.price })),
  };
}

export type FullMenuItem = {
  id: string;
  name: I18nText;
  description: I18nText;
  base_price: number | null;
  variants: { id: string; name: I18nText; price: number }[];
  extras: { id: string; name: I18nText; price: number }[];
};
export type FullMenuCategory = { id: string; name: I18nText; schedule_id: string | null; items: FullMenuItem[] };

/** Whole menu (all items, variants, extras), for prices and translations. */
export async function adminFullMenu(restaurantId: string): Promise<FullMenuCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select(
      "id, name, schedule_id, position, items(id, name, description, base_price, position, deleted_at, item_variants(id, name, price, position), item_extras(id, name, price, position))",
    )
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("position");
  const byPos = <T extends { position: number }>(a: T[]) => [...a].sort((x, y) => x.position - y.position);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name as I18nText,
    schedule_id: c.schedule_id,
    items: byPos(c.items.filter((i) => !i.deleted_at)).map((i) => ({
      id: i.id,
      name: i.name as I18nText,
      description: i.description as I18nText,
      base_price: i.base_price,
      variants: byPos(i.item_variants).map((v) => ({ id: v.id, name: v.name as I18nText, price: v.price })),
      extras: byPos(i.item_extras).map((x) => ({ id: x.id, name: x.name as I18nText, price: x.price })),
    })),
  }));
}
