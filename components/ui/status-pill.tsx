import { cn } from "@/lib/utils/cn";

const tones = {
  success: { dot: "bg-success", text: "text-success", bg: "bg-primary-soft" },
  warning: { dot: "bg-warning", text: "text-warning", bg: "bg-warning-soft" },
  danger: { dot: "bg-danger", text: "text-danger", bg: "bg-danger-soft" },
  info: { dot: "bg-info", text: "text-info", bg: "bg-info-soft" },
  neutral: { dot: "bg-muted", text: "text-muted", bg: "bg-ink/5" },
} as const;

export type StatusTone = keyof typeof tones;

/** Dot + label status, e.g. "Ouvert", "Essai", "Expiré". */
export function StatusPill({
  tone,
  children,
  pulse,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", t.bg, t.text, className)}>
      <span className={cn("size-2 rounded-full", t.dot, pulse && "animate-pulse")} aria-hidden />
      {children}
    </span>
  );
}
