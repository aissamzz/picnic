import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth.signup");
  return (
    <section aria-labelledby="signup-title" className="flex flex-col gap-6">
      <div>
        <h1 id="signup-title" className="text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <SignupForm next={next} />
    </section>
  );
}
