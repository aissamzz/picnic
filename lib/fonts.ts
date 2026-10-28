import { Cairo, Inter } from "next/font/google";

/**
 * UI fonts of the site/owner app: Inter (Latin) and Cairo (Arabic).
 * preload is off: Next would otherwise attach these preloads to every route
 * sharing the global stylesheet, public menus included (which self-host and
 * preload only what they show, see components/menu/menu-document.tsx).
 */
export const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap", preload: false });
export const cairo = Cairo({ variable: "--font-cairo", subsets: ["arabic", "latin"], display: "swap", preload: false });
