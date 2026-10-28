import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "UI", robots: { index: false } };

export default async function DevUiPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_UI !== "true") notFound();
  const t = await getTranslations("dev");
  return (
    <main className="mx-auto max-w-5xl px-4 pt-6 pb-24">
      <Showcase title={t("title")} subtitle={t("subtitle")} />
    </main>
  );
}
