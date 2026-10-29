"use client";

import { Camera, FileText, ImagePlus, Keyboard, Lightbulb, Loader2, ScanText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { startImport } from "@/lib/actions/ai-import";
import { resizeImage } from "@/lib/utils/resize-image";

const MAX_PHOTOS = 5;
const MAX_PDF = 20 * 1024 * 1024;

/**
 * Photos (camera or gallery, up to 5) or one PDF -> AI reading -> review page.
 * On failure the files stay picked so the owner can retry or add a sharper photo.
 */
export function MenuImporter({
  reviewPrefix,
  importsLeft,
  onManual,
}: {
  /** The import id is appended: "/app/menu/importer/" or "/app/onboarding/4?import=". */
  reviewPrefix: string;
  importsLeft: number | null;
  onManual?: () => void;
}) {
  const t = useTranslations("import");
  const router = useRouter();
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const previews = React.useMemo(() => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)), [files]);
  React.useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const isPdf = files[0]?.type === "application/pdf";
  const noneLeft = importsLeft === 0;

  function add(list: FileList | null, kind: "image" | "pdf") {
    if (!list?.length) return;
    setError(null);
    const picked = Array.from(list);
    if (kind === "pdf") {
      const pdf = picked[0];
      if (pdf.type !== "application/pdf" || pdf.size > MAX_PDF) return setError("files");
      return setFiles([pdf]);
    }
    if (picked.some((f) => !f.type.startsWith("image/"))) return setError("files");
    const next = [...(isPdf ? [] : files), ...picked];
    if (next.length > MAX_PHOTOS) setError("files");
    setFiles(next.slice(0, MAX_PHOTOS));
  }

  async function read() {
    setError(null);
    setReading(true);
    try {
      const form = new FormData();
      for (const f of await Promise.all(files.map((f) => resizeImage(f)))) form.append("files", f);
      const r = await startImport(form);
      if (!r.ok) {
        setError(r.error);
        setReading(false);
        return;
      }
      router.push(reviewPrefix + r.data.importId);
    } catch {
      setError("failed");
      setReading(false);
    }
  }

  if (reading) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center" role="status" aria-live="polite">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-lg font-semibold">{t("reading")}</p>
        <p className="text-sm text-muted">{t("readingHint")}</p>
      </Card>
    );
  }

  const failed = error && ["unreadable", "not_menu", "failed"].includes(error);

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <Card className="flex flex-col gap-3 border-warning/40 bg-warning-soft p-4" role="alert">
          <div>
            <p className="font-semibold">{t("failedTitle")}</p>
            <p className="text-sm">{t(`errors.${error}` as never)}</p>
          </div>
          <Tips />
        </Card>
      ) : (
        <FormAlert>{error && t(`errors.${error}` as never)}</FormAlert>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <PickButton icon={Camera} label={t("photo")} accept="image/*" capture disabled={noneLeft} onPick={(l) => add(l, "image")} />
        <PickButton icon={ImagePlus} label={t("gallery")} accept="image/jpeg,image/png,image/webp" multiple disabled={noneLeft} onPick={(l) => add(l, "image")} />
        <PickButton icon={FileText} label={t("pdf")} accept="application/pdf" disabled={noneLeft} onPick={(l) => add(l, "pdf")} />
      </div>
      <p className="text-sm text-muted">
        {t("photosHint")} {t("pdfHint")}
        {importsLeft != null && <span className="block font-medium text-ink">{t("left", { count: importsLeft })}</span>}
      </p>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("title")}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative">
              {previews[i] ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={previews[i]!} alt={t("photoAlt", { n: i + 1 })} className="size-20 rounded-md border border-line object-cover" />
              ) : (
                <span className="flex h-20 max-w-48 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm">
                  <FileText className="size-5 shrink-0 text-muted" aria-hidden />
                  <span className="truncate">{f.name}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setFiles((s) => s.filter((_, j) => j !== i))}
                aria-label={t("remove", { name: previews[i] ? t("photoAlt", { n: i + 1 }) : f.name })}
                className="absolute -end-2 -top-2 grid size-7 place-items-center rounded-full bg-ink text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="lg" className="flex-1" disabled={!files.length || noneLeft} onClick={() => void read()}>
          <ScanText aria-hidden />
          {failed ? t("retry") : t("start")}
        </Button>
        {onManual && (failed || noneLeft || error === "unavailable" || error === "quota") && (
          <Button size="lg" variant="secondary" onClick={onManual}>
            <Keyboard aria-hidden />
            {t("manual")}
          </Button>
        )}
      </div>
    </div>
  );
}

export function Tips() {
  const t = useTranslations("import");
  return (
    <div className="flex gap-2 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t("tipsTitle")}</p>
        <ul className="list-disc ps-4">
          {(t.raw("tips") as string[]).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PickButton({
  icon: Icon,
  label,
  accept,
  multiple,
  capture,
  disabled,
  onPick,
}: {
  icon: typeof Camera;
  label: string;
  accept: string;
  multiple?: boolean;
  capture?: boolean;
  disabled?: boolean;
  onPick: (files: FileList | null) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 text-start font-medium hover:bg-sand disabled:opacity-50"
      >
        <Icon className="size-5 text-primary" aria-hidden />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        capture={capture ? "environment" : undefined}
        aria-label={label}
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
