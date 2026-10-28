import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { refreshSession } from "@/lib/supabase/middleware";

/** Paths that need a fresh Supabase session. Public menus stay cookie-free and cacheable. */
const AUTH_PATHS = /^\/(app|admin|connexion|inscription|verification|mot-de-passe-oublie|invitation)(\/|$)/;

export async function middleware(request: NextRequest) {
  // `?lang=fr|ar` forces a locale (shareable links, SEO alternates) and persists it.
  const lang = request.nextUrl.searchParams.get("lang");
  const requestHeaders = new Headers(request.headers);
  if (isLocale(lang)) requestHeaders.set("x-qaima-locale", lang);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  if (AUTH_PATHS.test(request.nextUrl.pathname)) {
    await refreshSession(request, response);
    // Route guards (owner membership, admin MFA) are added in phases 2 and 8.
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
