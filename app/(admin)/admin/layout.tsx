import { ArrowLeft, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/ui/language-picker";
import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  const t = await getTranslations("admin");
  return (
    <div className="flex min-h-dvh flex-col bg-sand lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-line bg-surface p-4 lg:w-64 lg:border-e lg:border-b-0">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo />
            <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">{t("title")}</span>
          </Link>
          <LanguagePicker className="lg:hidden" />
        </div>
        <nav aria-label={t("title")} className="flex gap-1 lg:flex-col">
          <Link href="/admin/codes" className="flex min-h-11 items-center gap-2 rounded-md bg-primary-soft px-3 text-sm font-semibold text-primary">
            <KeyRound className="size-4" aria-hidden />
            {t("nav.codes")}
          </Link>
        </nav>
        <div className="mt-auto hidden flex-col gap-2 lg:flex">
          <LanguagePicker className="self-start" />
          <Link href="/app" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t("nav.backToApp")}
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
