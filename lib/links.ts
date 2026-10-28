import { APP_DOMAIN, APP_URL, TABLE_SLUG_SUFFIX } from "@/lib/config";

/** Order link (social, posters) and table-menu link (QR on tables). */
export function menuLinks(slug: string) {
  return {
    orderUrl: `${APP_URL}/${slug}`,
    tableUrl: `${APP_URL}/${slug}${TABLE_SLUG_SUFFIX}`,
    orderLabel: `${APP_DOMAIN}/${slug}`,
    tableLabel: `${APP_DOMAIN}/${slug}${TABLE_SLUG_SUFFIX}`,
  };
}
