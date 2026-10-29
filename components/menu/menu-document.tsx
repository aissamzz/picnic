import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { preload } from "react-dom";
import type { Lang } from "@/lib/menu/types";
import "../../app/globals.css";

/**
 * <html> for public menus: no cookies, no i18n runtime, no next/font (fonts
 * are self-hosted so each page preloads only what it shows).
 */
export function MenuDocument({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  if (lang === "ar") preload("/fonts/menu/cairo.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="menu-doc">
      <body>
        {/* React hoists these into <head>. */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
