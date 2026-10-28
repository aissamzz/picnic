import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";

/**
 * Locale resolution (no locale segment in URLs, see DECISIONS.md):
 * 1. `x-locale` header set by middleware (from `?lang=`),
 * 2. NEXT_LOCALE cookie, 3. Accept-Language, 4. French.
 * Public menus override this with the restaurant's default_locale when
 * the diner has no cookie yet.
 */
export async function resolveLocale(): Promise<Locale> {
  const h = await headers();
  const forced = h.get("x-locale");
  if (isLocale(forced)) return forced;
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale(h.get("accept-language")) ?? defaultLocale;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Static (ISR) public menus call setRequestLocale(); everything else resolves per request.
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Africa/Algiers",
  };
});
