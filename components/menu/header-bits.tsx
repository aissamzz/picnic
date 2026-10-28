import { Info, Utensils } from "lucide-react";
import type { OpenState } from "@/lib/menu/hours";
import { cx as cn } from "@/lib/utils/cx";
import { fmt, type MenuLabels } from "./labels";

/** "Ouvert · ferme à 23:30" / "Fermé · ouvre à 11:00". Renders nothing before hydration. */
export function OpenStatus({ open, labels, className }: { open: OpenState | null; labels: MenuLabels; className?: string }) {
  if (!open || !open.hasHours) return null;
  const detail = open.open ? (open.closesAt ? fmt(labels.closesAt, { time: open.closesAt }) : null) : open.opensAt ? fmt(labels.opensAt, { time: open.opensAt }) : null;
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", className)}>
      <span className={cn("size-2 rounded-full", open.open ? "bg-[#22c55e]" : "bg-[#ef4444]")} aria-hidden />
      {open.open ? labels.open : labels.closed}
      {detail && (
        <span className="font-normal opacity-80">
          · <bdi>{detail}</bdi>
        </span>
      )}
    </span>
  );
}

export function InfoButton({ onClick, labels, className }: { onClick: () => void; labels: MenuLabels; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold", className)}>
      <Info className="size-4" aria-hidden />
      {labels.info}
    </button>
  );
}

export function TableChip({ label, className }: { label: string | null; className?: string }) {
  if (!label) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", className)}>
      <Utensils className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Logo circle, or the restaurant initial. */
export function LogoMark({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-m-surface", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- small logo; next/image would add a request hop
        <img src={url} alt="" className="size-full object-cover" width={96} height={96} />
      ) : (
        <span className="font-display text-2xl font-bold text-m-accent" aria-hidden>
          {Array.from(name.trim())[0]?.toUpperCase()}
        </span>
      )}
    </span>
  );
}
