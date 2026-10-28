import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/toast";
import { APP_NAME, APP_URL } from "@/lib/config";
import { cairo, inter } from "@/lib/fonts";
import { localeDir, type Locale } from "@/lib/i18n/config";
import "../globals.css";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(APP_URL),
    title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
    description: t("description", { app: APP_NAME }),
  };
}

export const viewport: Viewport = {
  themeColor: "#1F6B4A",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await getLocale()) as Locale;
  return (
    <html lang={locale} dir={localeDir(locale)} className={`${inter.variable} ${cairo.variable}`}>
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster dir={localeDir(locale)} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
