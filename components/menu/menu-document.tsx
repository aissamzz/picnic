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
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
