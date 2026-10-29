import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/ui/language-picker";
import { requireSuperAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [{ count: payments }, { data: calls }] = await Promise.all([
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.rpc("admin_call_list"),
  ]);
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
        <AdminNav counts={{ payments: payments ?? 0, calls: (calls ?? []).filter((c) => !c.called_today).length }} />
        <div className="mt-auto hidden flex-col gap-2 lg:flex">
          <LanguagePicker className="self-start" />
          <Link href="/app" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t("nav.backToApp")}
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
