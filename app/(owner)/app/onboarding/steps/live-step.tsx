import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkRow } from "@/components/owner/link-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KabyleBand } from "@/components/ui/kabyle-band";
import { APP_NAME } from "@/lib/config";
import { menuLinks } from "@/lib/links";
import { qrSvg } from "@/lib/qr";
import { markLive } from "../actions";
import { InstallPrompt } from "./install-prompt";

export async function LiveStep({ slug }: { slug: string }) {
  await markLive();
  const t = await getTranslations("onboarding.live");
  const links = menuLinks(slug);
  const [orderQr, tableQr] = await Promise.all([qrSvg(links.orderUrl), qrSvg(links.tableUrl)]);

  const blocks = [
    { title: t("orderLink"), hint: t("orderLinkHint"), url: links.orderUrl, label: links.orderLabel, qr: orderQr },
    { title: t("tableLink"), hint: t("tableLinkHint"), url: links.tableUrl, label: links.tableLabel, qr: tableQr },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden text-center">
        <KabyleBand />
        <div className="flex flex-col items-center gap-1 px-4 py-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted">{t("subtitle")}</p>
        </div>
      </Card>
      {blocks.map((b) => (
        <Card key={b.url} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div
            role="img"
            aria-label={t("qrAlt", { url: b.label })}
            className="mx-auto size-40 shrink-0 rounded-md border border-line bg-white p-1 sm:mx-0 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: b.qr }}
          />
          <div className="min-w-0 flex-1">
            <LinkRow title={b.title} hint={b.hint} url={b.url} label={b.label} copyLabel={t("copy")} copiedLabel={t("copied")} openLabel={t("open")} />
          </div>
        </Card>
      ))}
      <InstallPrompt label={t("install")} hint={t("installHint", { app: APP_NAME })} />
      <Button asChild size="lg" block>
        <Link href="/app">{t("dashboard")}</Link>
      </Button>
    </div>
  );
}
