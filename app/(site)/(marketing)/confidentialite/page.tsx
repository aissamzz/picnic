import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/marketing/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.legal"))("privacy") };
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
