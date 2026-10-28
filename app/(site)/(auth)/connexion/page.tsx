import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.login");
  return (
    <section aria-labelledby="login-title" className="flex flex-col gap-6">
      <div>
        <h1 id="login-title" className="text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <LoginForm next={next} />
    </section>
  );
}
