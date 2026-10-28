"use client";

import { FileText, ImageIcon, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

type UploadZoneProps = {
  id: string;
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  /** Max size per file in bytes. */
  maxSize?: number;
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Opens the camera directly on mobile. */
  capture?: "environment" | "user";
  disabled?: boolean;
  className?: string;
};

/** Tap or drop files. Validates count, type and size; lists picked files. */
export function UploadZone({
  id,
  label,
  hint,
  accept,
  multiple,
  maxFiles = multiple ? 5 : 1,
  maxSize = 10 * 1024 * 1024,
  files,
  onFilesChange,
  capture,
  disabled,
  className,
}: UploadZoneProps) {
  const t = useTranslations("ui.upload");
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function accepts(file: File) {
    if (!accept) return true;
    return accept.split(",").some((rule) => {
      const r = rule.trim();
      if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
      if (r.startsWith(".")) return file.name.toLowerCase().endsWith(r);
      return file.type === r;
    });
  }

  function add(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = Array.from(list);
    if (incoming.some((f) => !accepts(f))) return setError(t("wrongType"));
    if (incoming.some((f) => f.size > maxSize)) return setError(t("tooBig", { mb: Math.round(maxSize / 1024 / 1024) }));
    const next = multiple ? [...files, ...incoming] : incoming.slice(0, 1);
    if (next.length > maxFiles) return setError(t("tooMany", { max: maxFiles }));
    onFilesChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          dragging ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-sand",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
        <input
          id={id}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          capture={capture}
          disabled={disabled}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-line bg-surface ps-3 text-sm">
              {f.type.startsWith("image/") ? (
                <ImageIcon className="size-4 shrink-0 text-muted" aria-hidden />
              ) : (
                <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              )}
              <span className="flex-1 truncate" dir="auto">
                {f.name}
              </span>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center text-muted hover:text-danger"
                aria-label={t("remove", { name: f.name })}
                onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
