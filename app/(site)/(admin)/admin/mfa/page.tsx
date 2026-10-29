import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sessionAal } from "@/lib/auth/aal";
import { MfaForm } from "./mfa-form";

/** Second factor for the back office: enroll a TOTP app once, then verify each session. */
export default async function MfaPage() {
  const { profile } = await requireSession("/admin");
  if (!profile.is_super_admin) redirect("/app");
  if ((await sessionAal(await createClient())) === "aal2") redirect("/admin");
  const t = await getTranslations("admin.mfa");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <Logo />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <MfaForm />
    </main>
  );
}
