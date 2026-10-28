import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { VerificationFlow } from "./verification-flow";

export default async function VerificationPage() {
  const { profile } = await requireSession();
  const t = await getTranslations("account.verification");
  const supabase = await createClient();
  const { data: openRequest } = profile.phone_verified_at ? { data: null } : await supabase.rpc("my_open_verification");
  return (
    <div className="flex flex-col gap-4">
      <Link href="/app/compte" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <VerificationFlow phone={profile.phone ?? ""} verified={!!profile.phone_verified_at} initialRequestId={openRequest ?? null} />
    </div>
  );
}
