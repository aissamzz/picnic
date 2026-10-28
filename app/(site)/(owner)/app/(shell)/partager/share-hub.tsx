"use client";

import { Download, FileArchive, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { LinkRow } from "@/components/owner/link-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CopyButton } from "@/components/ui/copy-button";
import { APP_NAME } from "@/lib/config";
import { downloadBlob, qrPng, qrSvgBlob, renderPoster } from "@/lib/qr/poster";

export type ChannelStat = { kind: "view_table" | "view_order"; source: string | null; visits: number };
type Links = { orderUrl: string; tableUrl: string; orderLabel: string; tableLabel: string };

// Shortest forms accepted by lib/menu/beacon.ts.
const TRACKED = [
  ["instagram", "ig"],
  ["facebook", "fb"],
  ["tiktok", "tt"],
  ["whatsapp", "wa"],
  ["poster", "poster"],
] as const;

export function ShareHub({
  restaurantName,
  slug,
  links,
  stats,
  colors,
}: {
  restaurantName: string;
  slug: string;
  links: Links;
  stats: ChannelStat[];
  colors: { bg: string; fg: string };
}) {
  const t = useTranslations("owner.share");
  const tl = useTranslations("onboarding.live");
  const locale = useLocale();
  const [target, setTarget] = React.useState<"order" | "table">("order");
  const [busy, setBusy] = React.useState<string | null>(null);

  const bySource = new Map<string, number>();
  for (const s of stats) {
    const key = s.kind === "view_table" ? "table" : (s.source ?? "direct");
    bySource.set(key, (bySource.get(key) ?? 0) + Number(s.visits));
  }
  const rows = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));

  const url = target === "order" ? links.orderUrl : links.tableUrl;
  const label = target === "order" ? links.orderLabel : links.tableLabel;
  const headline = target === "order" ? t("posterOrder") : t("posterTable");
  const base = `${slug}${target === "table" ? "-menu" : ""}`;
  const poster = (width: number, height: number) =>
    renderPoster({ width, height, qrText: url, title: restaurantName, headline, footer: `${label} · ${APP_NAME}`, bg: colors.bg, fg: colors.fg, rtl: locale === "ar" });
  const files = {
    png: () => qrPng(url),
    svg: () => qrSvgBlob(url),
    story: () => poster(1080, 1920),
    post: () => poster(1080, 1080),
  };
  const names = { png: `${base}-qr.png`, svg: `${base}-qr.svg`, story: `${base}-story.png`, post: `${base}-post.png` };

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  const share = (u: string) => {
    if (navigator.share) navigator.share({ title: restaurantName, url: u }).catch(() => {});
    else navigator.clipboard.writeText(u);
  };

  return (
    <div className="flex flex-col gap-4">
      {(
        [
          ["order", t("orderLink"), t("orderHint"), links.orderUrl, links.orderLabel],
          ["table", t("tableLink"), t("tableHint"), links.tableUrl, links.tableLabel],
        ] as const
      ).map(([key, title, hint, u, l]) => (
        <Card key={key} className="flex flex-col gap-3 p-4">
          <LinkRow title={title} hint={hint} url={u} label={l} copyLabel={tl("copy")} copiedLabel={tl("copied")} openLabel={tl("open")} />
          <Button variant="soft" className="self-start" onClick={() => share(u)}>
            <Share2 aria-hidden />
            {t("share")}
          </Button>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>{t("statsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{t("statsEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map(([source, visits]) => (
                <li key={source} className="flex flex-col gap-1">
                  <span className="flex justify-between text-sm">
                    <span className="font-medium">{t(`sources.${source}` as never)}</span>
                    <span className="text-muted tabular">{t("visits", { count: visits })}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-sand" aria-hidden>
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(visits / max) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t("tracked")}</CardTitle>
            <p className="text-sm text-muted">{t("trackedHint")}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-line">
          {TRACKED.map(([source, code]) => {
            const u = `${links.orderUrl}?src=${code}`;
            return (
              <div key={source} className="flex items-center gap-2 py-2">
                <span className="w-24 shrink-0 text-sm font-medium">{t(`sources.${source}`)}</span>
                <code dir="ltr" className="flex-1 truncate text-sm text-muted">
                  {`${links.orderLabel}?src=${code}`}
                </code>
                <CopyButton value={u} label={`${tl("copy")} · ${t(`sources.${source}`)}`} copiedLabel={tl("copied")} iconOnly />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("downloads")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div role="group" aria-label={t("downloadsFor")} className="flex flex-wrap gap-2">
            <Chip selected={target === "order"} onClick={() => setTarget("order")}>
              {t("orderLink")}
            </Chip>
            <Chip selected={target === "table"} onClick={() => setTarget("table")}>
              {t("tableLink")}
            </Chip>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["png", "svg", "story", "post"] as const).map((k) => (
              <Button
                key={k}
                variant="secondary"
                className="justify-start"
                loading={busy === k}
                onClick={() => run(k, async () => downloadBlob(await files[k](), names[k]))}
              >
                <Download aria-hidden />
                {t(k)}
              </Button>
            ))}
          </div>
          <Button
            loading={busy === "zip"}
            onClick={() =>
              run("zip", async () => {
                const { default: JSZip } = await import("jszip");
                const zip = new JSZip();
                for (const k of Object.keys(files) as (keyof typeof files)[]) zip.file(names[k], await files[k]());
                downloadBlob(await zip.generateAsync({ type: "blob" }), `${base}-qr.zip`);
              })
            }
          >
            <FileArchive aria-hidden />
            {t("zip")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
