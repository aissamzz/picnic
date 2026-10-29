/** Single place to rename the product. */
export const APP_NAME = "Liinky";

/** Public domain, e.g. "liinky.app". Used to build menu links. */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (APP_DOMAIN.startsWith("localhost") ? `http://${APP_DOMAIN}` : `https://${APP_DOMAIN}`);

export const TABLE_SLUG_SUFFIX = "-menu";

/** Referral code from a /inscription?ref= link (httpOnly, 30 days). */
export const REFERRAL_COOKIE = "liinky_ref";

/** Super admin viewing an owner dashboard read-only (restaurant id, httpOnly). */
export const VIEW_AS_COOKIE = "liinky_view_as";
