import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotFlow } from "./forgot-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <section aria-labelledby="forgot-title" className="flex flex-col gap-6">
      <div>
        <h1 id="forgot-title" className="text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <ForgotFlow />
    </section>
  );
}
