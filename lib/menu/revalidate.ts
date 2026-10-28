import "server-only";
import { revalidateTag } from "next/cache";
import { menuTag } from "./public-menu";

/**
 * Drops the cached public menu (both links, every language) after an owner
 * edit. Pass the old slug too after a slug change so it starts redirecting.
 */
export function revalidateMenu(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs.filter(Boolean) as string[])) revalidateTag(menuTag(slug));
}
