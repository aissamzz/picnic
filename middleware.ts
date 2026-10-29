import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, TABLE_SLUG_SUFFIX, VIEW_AS_COOKIE } from "@/lib/config";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "@/lib/i18n/config";
import { MENU_ROUTE_PREFIX, menuSegment } from "@/lib/routes";
import { parseMenuSegment } from "@/lib/slug";
import { refreshSession } from "@/lib/supabase/middleware";
import { sessionAal } from "@/lib/auth/aal";

// Old slug -> current slug, cached per instance for a minute.
const slugCache = new Map<string, { to: string | null; exp: number }>();

/** Current slug when `slug` is a renamed restaurant's old slug, else null. */
async function renamedTo(slug: string): Promise<string | null> {
  const hit = slugCache.get(slug);
  if (hit && hit.exp > Date.now()) return hit.to;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/resolve_public_slug`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
    });
    const rows = (await res.json()) as { slug: string; redirect: boolean }[];
    const to = Array.isArray(rows) && rows[0]?.redirect ? rows[0].slug : null;
    if (slugCache.size > 5000) slugCache.clear();
    slugCache.set(slug, { to, exp: Date.now() + 60_000 });
    return to;
  } catch {
    return null; // the page falls back to a query-less redirect
  }
}

/** Paths that need a fresh Supabase session. Public menus stay cookie-free and cacheable. */
const SESSION_PATHS = /^\/(app|admin|connexion|inscription|mot-de-passe-oublie|invitation)(\/|$)/;
const PROTECTED = /^\/(app|admin)(\/|$)/;
const GUEST_ONLY = /^\/(connexion|inscription)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // `?lang=fr|ar` forces a locale (shareable links, SEO alternates) and persists it.
  const lang = searchParams.get("lang");

  // Restaurant links: rewrite to the cookie-free, cacheable menu route.
  // Language: ?lang > diner's choice (cookie) > browser > restaurant default.
  const segment = menuSegment(pathname);
  if (segment) {
    // Renamed restaurant: 301 to the new link, keeping ?t= (table QR codes) and ?src=.
    const { slug, mode } = parseMenuSegment(segment);
    const to = await renamedTo(slug);
    if (to) {
      const url = request.nextUrl.clone();
      url.pathname = `/${to}${mode === "table" ? TABLE_SLUG_SUFFIX : ""}`;
      return NextResponse.redirect(url, 301);
    }
    const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
    const chosen = isLocale(lang) ? lang : isLocale(cookie) ? cookie : (negotiateLocale(request.headers.get("accept-language")) ?? "default");
    const url = request.nextUrl.clone();
    url.pathname = `${MENU_ROUTE_PREFIX}/${chosen}/${encodeURIComponent(segment)}`;
    const res = NextResponse.rewrite(url);
    if (isLocale(lang)) res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  const requestHeaders = new Headers(request.headers);
  if (isLocale(lang)) requestHeaders.set("x-locale", lang);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isLocale(lang)) {
    response.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  // Referral links (/inscription?ref=CODE): remembered until the restaurant is created.
  const ref = searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
    response.cookies.set(REFERRAL_COOKIE, ref.toUpperCase(), { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax", httpOnly: true });
  }
  if (!SESSION_PATHS.test(pathname)) return response;

  const { user, supabase } = await refreshSession(request, response);

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
  // Admin pages need a two-factor session; /admin/mfa enrolls or verifies it.
  // (The admin role itself is checked server-side; the database requires aal2 as well.)
  if (user && supabase && /^\/admin(\/|$)/.test(pathname) && !pathname.startsWith("/admin/mfa")) {
    if ((await sessionAal(supabase)) !== "aal2") return redirectTo("/admin/mfa");
  }
  // Read-only "view as owner": nothing but page loads under /app.
  if (request.cookies.has(VIEW_AS_COOKIE) && /^\/app(\/|$)/.test(pathname) && request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Read-only session", { status: 403 });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
