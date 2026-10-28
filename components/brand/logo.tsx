import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

/** Wordmark: a QR-corner mark + the app name. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold text-ink", className)} dir="ltr">
      <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
        <rect width="24" height="24" rx="7" fill="var(--primary)" />
        <rect x="5" y="5" width="6" height="6" rx="1.5" fill="none" stroke="#fff" strokeWidth="2" />
        <rect x="13" y="13" width="6" height="6" rx="1.5" fill="var(--accent)" />
        <rect x="14" y="5" width="2.5" height="2.5" rx="0.6" fill="#fff" />
        <rect x="5" y="14" width="2.5" height="2.5" rx="0.6" fill="#fff" />
      </svg>
      {!compact && <span className="text-xl tracking-tight">{APP_NAME}</span>}
    </span>
  );
}
