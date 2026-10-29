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
      matcher: ({ url }) => sameOrigin(url) && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/brand/")),
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

// ---------------------------------------------------------------------------
// Web push (owner app): waiter calls, orders, billing notices.
// The payload is built by lib/push/payload.ts.
// ---------------------------------------------------------------------------
type PushBody = { title: string; body: string; url: string; tag: string; requireInteraction: boolean; lang: "fr" | "ar" };

self.addEventListener("push", (event) => {
  let data: PushBody | null = null;
  try {
    data = event.data?.json() as PushBody;
  } catch {
    data = null;
  }
  if (!data?.title) return;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      // Same tag again (a new call from the same table) still rings.
      renotify: true,
      requireInteraction: data.requireInteraction,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      lang: data.lang,
      dir: data.lang === "ar" ? "rtl" : "ltr",
      data: { url: data.url },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? "/app", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open owner-app window when there is one.
      const app = windows.find((w) => new URL(w.url).pathname.startsWith("/app"));
      if (app) {
        await app.focus();
        await app.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
