import "server-only";
import { createAnonClient } from "@/lib/supabase/server";

export type I18nText = { fr?: string; ar?: string };

export type PublicMenu = {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    commune: string | null;
    logo_path: string | null;
    cover_path: string | null;
    template_key: string;
    default_locale: "fr" | "ar";
    enabled_locales: ("fr" | "ar")[];
    status: string;
    is_paused: boolean;
    show_powered_by: boolean;
    ordering_available: boolean;
  };
  tables: { id: string; code: string; label: string }[];
  categories: {
    id: string;
    name: I18nText;
    items: {
      id: string;
      name: I18nText;
      description: I18nText;
      base_price: number | null;
      tags: string[];
      is_sold_out: boolean;
      variants: { id: string; name: I18nText; price: number }[];
    }[];
  }[];
};

/** Resolves a slug (current or historical). */
export async function resolveSlug(slug: string): Promise<{ slug: string; redirect: boolean } | null> {
  const { data } = await createAnonClient().rpc("resolve_public_slug", { p_slug: slug });
  return data?.[0] ?? null;
}

export async function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  const { data } = await createAnonClient().rpc("get_public_menu", { p_slug: slug });
  return (data as PublicMenu | null) ?? null;
}

export function t(text: I18nText | undefined, locale: "fr" | "ar"): string {
  return text?.[locale] || text?.fr || text?.ar || "";
}
