import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/ui/language-picker";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-4">
        <Link href="/" aria-label="Liinky" className="rounded-md">
          <Logo />
        </Link>
        <LanguagePicker />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-10">
        <p className="mb-6 text-sm text-muted">{t("tagline")}</p>
        {children}
      </main>
    </div>
  );
}
