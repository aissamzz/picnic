/**
 * Joins class names without tailwind-merge (~8 KB gzipped). Use in public-menu
 * code, where every byte ships to diners and conflicting classes aren't passed.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
