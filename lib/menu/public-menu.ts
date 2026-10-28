import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import type { PublicMenu } from "./types";

export const menuTag = (slug: string) => `menu:${slug}`;

/** Resolves a slug (current or historical). Cached until the restaurant changes. */
export function resolveSlug(slug: string): Promise<{ slug: string; redirect: boolean } | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAnonClient().rpc("resolve_public_slug", { p_slug: slug });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    ["resolve-slug", slug],
    { tags: [menuTag(slug)], revalidate: 3600 },
  )();
}

/** The public menu payload (security-definer RPC, anon key, no cookies). */
export function getPublicMenu(slug: string): Promise<PublicMenu | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await createAnonClient().rpc("get_public_menu", { p_slug: slug });
      if (error) throw error;
      return (data as unknown as PublicMenu | null) ?? null;
    },
    ["public-menu", slug],
    { tags: [menuTag(slug)], revalidate: 3600 },
  )();
}
