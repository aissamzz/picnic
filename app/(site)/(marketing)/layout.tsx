import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/ui/language-picker";
import { APP_NAME } from "@/lib/config";

/** Public site: header with the horizontal logo, footer on Ink with the reversed logo. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("marketing");
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="rounded-md" aria-label={t("nav.home")}>
            <Logo height={34} decorative />
          </Link>
          <nav aria-label={APP_NAME} className="flex items-center gap-1 sm:gap-2">
            <Link href="/tarifs" className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-white sm:inline-flex">
              {t("nav.pricing")}
            </Link>
            <Link href="/demo" className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-white sm:inline-flex">
              {t("nav.demo")}
            </Link>
            <Link href="/aide" className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-white md:inline-flex">
              {t("nav.help")}
            </Link>
            <LanguagePicker />
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-xl bg-ink px-4 text-sm font-bold text-white hover:bg-ink/90">
              {t("nav.login")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <Logo variant="reversed" height={36} />
            <p className="max-w-xs text-sm text-white/75">{t("footer.tagline")}</p>
          </div>
          <nav aria-label={t("footer.tagline")} className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {[
              ["/tarifs", t("nav.pricing")],
              ["/demo", t("nav.demo")],
              ["/aide", t("nav.help")],
              ["/inscription", t("nav.trial")],
              ["/conditions", t("footer.terms")],
              ["/confidentialite", t("footer.privacy")],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex min-h-11 items-center text-white/85 hover:text-white">
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-white/60">{t("footer.rights", { year: new Date().getFullYear(), app: APP_NAME })}</p>
      </footer>
    </div>
  );
}
