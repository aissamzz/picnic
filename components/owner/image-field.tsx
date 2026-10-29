"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import * as React from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { cropToBlob, ImageCropper, type Area } from "@/components/ui/image-cropper";
import { cn } from "@/lib/utils/cn";

type Labels = { add: string; change: string; remove: string; crop: string; use: string };

/** Pick -> crop -> upload an image; shows the current one. Without `aspect` the image is uploaded as is (logos). */
export function ImageField({
  label,
  hint,
  url,
  aspect,
  round,
  labels,
  upload,
  remove,
  onChanged,
  onError,
  disabled,
}: {
  label: string;
  hint?: string;
  url: string | null;
  aspect?: number;
  round?: boolean;
  labels: Labels;
  upload: (file: File) => Promise<{ ok: boolean; error?: string }>;
  remove: () => Promise<{ ok: boolean; error?: string }>;
  onChanged: () => void;
  onError: (key: string) => void;
  disabled?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<Area | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(url);
  React.useEffect(() => setPreview(url), [url]);

  async function send(file: File, previewUrl: string) {
    setBusy(true);
    try {
      const r = await upload(file);
      if (!r.ok) return onError(r.error ?? "errors.generic");
      setPreview(previewUrl);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function applyCrop() {
    if (!src || !crop) return;
    setSrc(null);
    setBusy(true);
    try {
      const blob = await cropToBlob(src, crop, "image/webp", 0.9);
      const r = await upload(new File([blob], "image.webp", { type: "image/webp" }));
      if (!r.ok) return onError(r.error ?? "errors.generic");
      setPreview(URL.createObjectURL(blob));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden border border-line bg-sand",
            round ? "size-20 rounded-full" : aspect ? "h-20 rounded-md" : "h-20 w-40 rounded-md bg-white p-2",
          )}
          style={round || !aspect ? undefined : { aspectRatio: String(aspect) }}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-muted" aria-hidden />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- owner-side preview
            <img src={preview} alt="" className={cn("size-full", aspect ? "object-cover" : "object-contain")} />
          ) : (
            <ImagePlus className="size-6 text-muted" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={disabled || busy} onClick={() => fileRef.current?.click()} aria-label={`${preview ? labels.change : labels.add} · ${label}`}>
            {preview ? labels.change : labels.add}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="danger-ghost"
              disabled={disabled || busy}
              aria-label={`${labels.remove} · ${label}`}
              onClick={async () => {
                setBusy(true);
                const r = await remove();
                setBusy(false);
                if (!r.ok) return onError(r.error ?? "errors.generic");
                setPreview(null);
                onChanged();
              }}
            >
              <Trash2 aria-hidden />
              {labels.remove}
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!aspect) return void send(f, URL.createObjectURL(f));
          const reader = new FileReader();
          reader.onload = () => setSrc(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />
      <BottomSheet
        open={!!src}
        onOpenChange={(o) => !o && setSrc(null)}
        title={labels.crop}
        footer={
          <Button type="button" block size="lg" onClick={applyCrop}>
            {labels.use}
          </Button>
        }
      >
        {src && aspect && <ImageCropper src={src} aspect={aspect} round={round} onCropComplete={setCrop} />}
      </BottomSheet>
    </div>
  );
}
