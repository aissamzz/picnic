// Builds public/sw.js after `next build` (Turbopack-compatible): `serwist build`.
import { serwist } from "@serwist/next/config";

// Bump with the content of public/offline.html.
const revision = "offline-v2";

export default await serwist({
  swSrc: "sw/sw.ts",
  swDest: "public/sw.js",
  // Only the offline page is precached; everything else is cached at run time.
  globPatterns: [],
  precachePrerendered: false,
  additionalPrecacheEntries: [
    { url: "/offline.html", revision },
    { url: "/brand/liinky-stacked.svg", revision },
  ],
});
