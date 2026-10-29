/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";
import { menuSegment } from "../lib/routes";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;
const sameOrigin = (url: URL) => url.origin === self.location.origin;

/**
 * Liinky service worker.
 * - Public menus: network first, the last version seen per link is kept (diners
 *   with a weak connection still see the menu, with an offline banner).
 * - Owner app: menu-editing pages kept the same way so sold-out toggles and
 *   price edits can be queued offline (see lib/offline/queue.ts).
 * - Static assets: cache first (hashed file names). Supabase/API: network only.
 * Nothing else is precached: diners must not download the whole app.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ request }) => request.method !== "GET", handler: new NetworkOnly() },
    { matcher: ({ url }) => !sameOrigin(url) && !url.pathname.startsWith("/storage/v1/object/public/"), handler: new NetworkOnly() },
    {
      matcher: ({ url }) => url.pathname.startsWith("/storage/v1/object/public/"),
      handler: new StaleWhileRevalidate({ cacheName: "menu-images", plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * DAY })] }),
    },
    {
      matcher: ({ url }) => sameOrigin(url) && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/icons/")),
      handler: new CacheFirst({ cacheName: "static", plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 365 * DAY })] }),
    },
    {
      matcher: ({ url }) => sameOrigin(url) && url.pathname.startsWith("/_next/image"),
      handler: new StaleWhileRevalidate({ cacheName: "next-images", plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 30 * DAY })] }),
    },
    {
      // Restaurant links (/{slug}, /{slug}-menu). The table label comes from ?t= at run time, so one copy per link.
      matcher: ({ request, url }) => request.mode === "navigate" && sameOrigin(url) && menuSegment(url.pathname) !== null,
      handler: new NetworkFirst({
        cacheName: "menus",
        networkTimeoutSeconds: 5,
        matchOptions: { ignoreSearch: true },
        plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * DAY })],
      }),
    },
    {
      matcher: ({ request, url }) => request.mode === "navigate" && sameOrigin(url) && /^\/app(\/menu(\/.*)?)?$/.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "owner-pages",
        networkTimeoutSeconds: 5,
        plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 7 * DAY })],
      }),
    },
    { matcher: () => true, handler: new NetworkOnly() },
  ],
  fallbacks: {
    entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
