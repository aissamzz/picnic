/**
 * First path segments owned by the app. Any other single-segment path is a
 * restaurant link (`/{slug}` or `/{slug}-menu`) and is rewritten by the
 * middleware to the cacheable menu route. Every entry of 3+ characters must
 * also be in public.reserved_slugs (checked by lib/routes.test.ts).
 */
export const APP_ROOTS = [
  "app",
  "admin",
  "api",
  "dev",
  "connexion",
  "inscription",
  "mot-de-passe-oublie",
  "invitation",
  "verification",
  "tarifs",
  "aide",
  "conditions",
  "confidentialite",
  "demo",
  "apercu",
  "r",
] as const;

const ROOTS = new Set<string>(APP_ROOTS);

/** Internal prefix of the cached menu route: /r/{lang}/{segment}. */
export const MENU_ROUTE_PREFIX = "/r";

/** Returns the menu segment when `pathname` is a restaurant link, else null. */
export function menuSegment(pathname: string): string | null {
  const m = /^\/([^/.]+)\/?$/.exec(pathname);
  if (!m) return null;
  const seg = decodeURIComponent(m[1]).toLowerCase();
  return ROOTS.has(seg) ? null : seg;
}
