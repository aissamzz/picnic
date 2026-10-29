import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/marketing/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.legal"))("terms") };
}

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}
