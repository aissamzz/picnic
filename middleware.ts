import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { refreshSession } from "@/lib/supabase/middleware";

/** Paths that need a fresh Supabase session. Public menus stay cookie-free and cacheable. */
const SESSION_PATHS = /^\/(app|admin|connexion|inscription|mot-de-passe-oublie|invitation)(\/|$)/;
const PROTECTED = /^\/(app|admin)(\/|$)/;
const GUEST_ONLY = /^\/(connexion|inscription)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // `?lang=fr|ar` forces a locale (shareable links, SEO alternates) and persists it.
  const lang = searchParams.get("lang");
  const requestHeaders = new Headers(request.headers);
  if (isLocale(lang)) requestHeaders.set("x-locale", lang);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  if (!SESSION_PATHS.test(pathname)) return response;

  const { user } = await refreshSession(request, response);

  const redirectTo = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };
  if (!user && PROTECTED.test(pathname)) {
    return redirectTo(`/connexion?next=${encodeURIComponent(pathname + request.nextUrl.search)}`);
  }
  if (user && GUEST_ONLY.test(pathname)) {
    return redirectTo(searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/app");
  }
  // Admin role and MFA are checked server-side in the admin layout (phase 8 adds AAL2 here).
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
