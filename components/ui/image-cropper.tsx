"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";

type ImageCropperProps = {
  src: string;
  /** width / height, e.g. 1 for logos, 16/9 for covers. */
  aspect: number;
  round?: boolean;
  onCropComplete: (area: Area) => void;
};

/** Pan + zoom cropper. Pair with `cropToBlob` to get the final image. */
export function ImageCropper({ src, aspect, round, onCropComplete }: ImageCropperProps) {
  const t = useTranslations("ui.cropper");
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const zoomId = React.useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-72 overflow-hidden rounded-lg bg-ink" dir="ltr">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={round ? "round" : "rect"}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, px) => onCropComplete(px)}
        />
      </div>
      <label htmlFor={zoomId} className="flex items-center gap-3 text-sm font-medium">
        {t("zoom")}
        <input
          id={zoomId}
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-11 flex-1 accent-[var(--primary)]"
        />
      </label>
    </div>
  );
}

/** Renders the cropped area to a JPEG/WebP blob in the browser. */
export async function cropToBlob(src: string, area: Area, type = "image/webp", quality = 0.9): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), type, quality),
  );
}

export type { Area };
