import { TABLE_SLUG_SUFFIX } from "@/lib/config";

/** Mirrors public.slug_is_well_formed() in the database. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

export function isWellFormedSlug(slug: string): boolean {
  return (
    SLUG_PATTERN.test(slug) && slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && !slug.endsWith(TABLE_SLUG_SUFFIX)
  );
}

/** "Café El Bahia" -> "cafe-el-bahia". Non-Latin names yield "" (caller falls back). */
export function slugify(input: string): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
  // "...-menu" is reserved for table links.
  return s.endsWith(TABLE_SLUG_SUFFIX) ? s.slice(0, -TABLE_SLUG_SUFFIX.length) : s;
}

/** Candidate slugs, best first: name, name-commune, name-2, name-3… */
export function slugCandidates(name: string, commune?: string | null, fallback = "restaurant"): string[] {
  const town = commune ? slugify(commune) : "";
  // Arabic-only names have no Latin slug: "restaurant-bejaia" beats "restaurant".
  const base = slugify(name) || (town ? `${fallback}-${town}` : fallback);
  const out = [base];
  if (town && !base.includes(town)) out.push(`${base}-${town}`.slice(0, SLUG_MAX).replace(/-+$/, ""));
  for (let i = 2; i <= 9; i++) out.push(`${base.slice(0, SLUG_MAX - 2)}-${i}`);
  return [...new Set(out)].filter(isWellFormedSlug);
}

/** Splits a public path segment into the restaurant slug and the link mode. */
export function parseMenuSegment(segment: string): { slug: string; mode: "table" | "order" } {
  if (segment.endsWith(TABLE_SLUG_SUFFIX)) return { slug: segment.slice(0, -TABLE_SLUG_SUFFIX.length), mode: "table" };
  return { slug: segment, mode: "order" };
}
