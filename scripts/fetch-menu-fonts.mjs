#!/usr/bin/env node
// Downloads the display face of each menu template (one weight, woff2) from
// Google Fonts into public/fonts/menu/. Run once; the files are committed.
// Self-hosting lets the menu page preload only the active template's face.
import { writeFileSync } from "node:fs";

const FONTS = {
  pizzeria: ["Archivo Black", 400, ["latin"]],
  cafe: ["Fraunces", 600, ["latin"]],
  traditionnel: ["Reem Kufi", 600, ["latin", "arabic"]],
  gastro: ["Cormorant Garamond", 600, ["latin"]],
  patisserie: ["Quicksand", 700, ["latin"]],
  grill: ["Bebas Neue", 400, ["latin"]],
  jus: ["Fredoka", 600, ["latin"]],
  mer: ["DM Serif Display", 400, ["latin"]],
  coffee: ["Space Grotesk", 600, ["latin"]],
  // Arabic body text of every menu (variable weight).
  cairo: ["Cairo", "400..800", ["arabic"]],
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

for (const [key, [family, weight, subsets]] of Object.entries(FONTS)) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`, { headers: { "User-Agent": UA } })).text();
  // Blocks look like: /* latin */ @font-face { ... src: url(...) format('woff2'); unicode-range: ...; }
  for (const subset of subsets) {
    const block = css.split("/* ").find((b) => b.startsWith(`${subset} */`));
    if (!block) throw new Error(`${family}: no ${subset} subset`);
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)[1];
    const range = /unicode-range:\s*([^;]+);/.exec(block)[1];
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const file = subset === "latin" || key === "cairo" ? `${key}.woff2` : `${key}-${subset}.woff2`;
    writeFileSync(`public/fonts/menu/${file}`, buf);
    console.log(`${file}\t${(buf.length / 1024).toFixed(1)} KB\t${family} ${weight}\t${range.slice(0, 60)}`);
  }
}
