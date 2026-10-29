import { Cairo, Nunito } from "next/font/google";

/**
 * UI fonts of the site/owner app: Nunito (Latin, the brand face) and Cairo (Arabic).
 * preload is off: Next would otherwise attach these preloads to every route
 * sharing the global stylesheet, public menus included (which self-host and
 * preload only what they show, see components/menu/menu-document.tsx).
 */
export const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
export const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"], display: "swap", preload: false });
