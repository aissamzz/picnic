import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Faq } from "@/components/marketing/faq";
import { SUPPORT_PHONE } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("marketing.help"))("metaTitle") };
}

export default async function HelpPage() {
  const t = await getTranslations("marketing.help");
  const items = t.raw("items") as { q: string; a: string }[];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      {SUPPORT_PHONE ? (
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://wa.me/${SUPPORT_PHONE.replace(/^\+/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-24 flex-col justify-center gap-1 rounded-2xl bg-[#25D366] px-4 text-[#0B2E17]"
          >
            <MessageCircle className="size-6" aria-hidden />
            <span className="font-extrabold">{t("whatsapp")}</span>
            <span className="text-sm">{t("whatsappHint")}</span>
          </a>
          <a href={`tel:${SUPPORT_PHONE}`} className="flex min-h-24 flex-col justify-center gap-1 rounded-2xl bg-ink px-4 text-white">
            <Phone className="size-6" aria-hidden />
            <span className="font-extrabold">{t("call")}</span>
            <span className="text-sm text-white/80">{t("callHint")}</span>
          </a>
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-4 text-muted">{t("noContact")}</p>
      )}
      <h2 className="text-2xl font-extrabold tracking-tight">{t("faqTitle")}</h2>
      <Faq items={items} />
    </div>
  );
}
