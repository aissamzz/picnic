"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { removeLogo, uploadLogo } from "@/app/(site)/(owner)/app/onboarding/actions";
import { FormAlert } from "@/components/forms/form-alert";
import { ImageField } from "@/components/owner/image-field";
import { TemplatePicker } from "@/components/owner/template-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import { BRAND_PALETTE, TEMPLATE_SWATCH, type TemplateKey } from "@/lib/templates/meta";
import { cn } from "@/lib/utils/cn";
import { removeCover, saveAppearance, uploadCover } from "./actions";

type Initial = { templateKey: TemplateKey; primaryColor: string | null; logoUrl: string | null; coverUrl: string | null };
type PaletteColor = (typeof BRAND_PALETTE)[number];

export function AppearanceEditor({ slug, initial, defaultLang, editable }: { slug: string; initial: Initial; defaultLang: Locale; editable: boolean }) {
  const t = useTranslations("owner.appearance");
  const tr = useTranslations();
  const router = useRouter();
  const [templateKey, setTemplateKey] = React.useState(initial.templateKey);
  const [color, setColor] = React.useState<string | null>(initial.primaryColor);
  const [lang, setLang] = React.useState<Locale>(defaultLang);
  const [version, setVersion] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const dirty = templateKey !== initial.templateKey || color !== initial.primaryColor;
  const previewSrc = `/apercu/${templateKey}/${lang}/${slug}?accent=${color ? color.slice(1) : "none"}&v=${version}`;
  const imageLabels = { add: t("change"), change: t("change"), remove: t("remove"), crop: t("coverCrop"), use: tr("onboarding.info.cropSave") };
  const refreshPreview = () => {
    setVersion((v) => v + 1);
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="flex flex-col gap-4">
        <FormAlert>{error && tr(error as never)}</FormAlert>
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t("template")}</h2>
          <TemplatePicker value={templateKey} onChange={setTemplateKey} legend={t("template")} compact />
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <h2 id="color-title" className="font-semibold">
            {t("color")}
          </h2>
          <div role="radiogroup" aria-labelledby="color-title" className="flex flex-wrap gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={color === null}
              onClick={() => setColor(null)}
              className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-3 text-sm font-medium", color === null ? "border-primary" : "border-line")}
            >
              <span className="size-5 rounded-full" style={{ background: TEMPLATE_SWATCH[templateKey].accent }} aria-hidden />
              {t("colorTemplate")}
            </button>
            {BRAND_PALETTE.map((c: PaletteColor) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={t("colorName", { hex: c })}
                onClick={() => setColor(c)}
                className={cn("flex size-11 items-center justify-center rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
              >
                <span className="flex size-8 items-center justify-center rounded-full text-white" style={{ background: c }}>
                  {color === c && <Check className="size-4" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <ImageField
            label={t("logo")}
            url={initial.logoUrl}
            aspect={1}
            round
            labels={{ ...imageLabels, crop: tr("onboarding.info.cropTitle") }}
            disabled={!editable}
            upload={(file) => {
              const fd = new FormData();
              fd.append("logo", file);
              return uploadLogo(fd);
            }}
            remove={removeLogo}
            onChanged={refreshPreview}
            onError={setError}
          />
          <ImageField
            label={t("cover")}
            hint={t("coverHint")}
            url={initial.coverUrl}
            aspect={16 / 9}
            labels={imageLabels}
            disabled={!editable}
            upload={(file) => {
              const fd = new FormData();
              fd.append("cover", file);
              return uploadCover(fd);
            }}
            remove={removeCover}
            onChanged={refreshPreview}
            onError={setError}
          />
        </Card>

        {editable && dirty && (
          <div className="sticky bottom-16 z-20 -mx-4 flex justify-end border-t border-line bg-sand/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
            <Button
              size="lg"
              loading={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await saveAppearance({ templateKey, primaryColor: color as PaletteColor | null });
                  if (!r.ok) return setError(r.error);
                  toast(t("saved"));
                  router.refresh();
                })
              }
            >
              {t("save")}
            </Button>
          </div>
        )}
      </div>

      <section aria-labelledby="preview-title" className="flex flex-col gap-2 lg:sticky lg:top-20">
        <div className="flex items-center justify-between">
          <h2 id="preview-title" className="font-semibold">
            {t("preview")}
          </h2>
          <div role="group" aria-label={t("previewLang")} className="flex gap-1">
            {(["fr", "ar"] as const).map((l) => (
              <Chip key={l} selected={lang === l} onClick={() => setLang(l)} className="min-h-9 px-3 uppercase">
                {l}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[28px] border-8 border-ink bg-ink shadow-sheet">
          <iframe key={previewSrc} src={previewSrc} title={t("previewTitle")} className="h-[680px] w-full rounded-[20px] bg-white" loading="lazy" />
        </div>
      </section>
    </div>
  );
}
