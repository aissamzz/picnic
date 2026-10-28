/** Single place to rename the product. */
export const APP_NAME = "Qaima";

/** Public domain, e.g. "qaima.dz". Used to build menu links. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (APP_DOMAIN.startsWith("localhost") ? `http://${APP_DOMAIN}` : `https://${APP_DOMAIN}`);

export const TABLE_SLUG_SUFFIX = "-menu";
