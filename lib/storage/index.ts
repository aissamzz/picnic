export const PUBLIC_BUCKET = "menu-images";

/** Public URL of an object in the menu-images bucket (logos, covers, item photos). */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
