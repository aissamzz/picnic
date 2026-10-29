import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { Toaster } from "@/components/ui/toast";
import { APP_NAME, APP_URL } from "@/lib/config";
import { cairo, nunito } from "@/lib/fonts";
import { localeDir, type Locale } from "@/lib/i18n/config";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(APP_URL),
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("description", { app: APP_NAME }),
    // Installable owner app (menus stay plain pages: no manifest there).
    manifest: "/site.webmanifest",
    appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
    // brand/logo/final/web/head-snippet.html
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/favicon.svg", type: "image/svg+xml" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#E5245E",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={localeDir(locale)} className={`${nunito.variable} ${cairo.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster dir={localeDir(locale)} />
          <RegisterServiceWorker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
