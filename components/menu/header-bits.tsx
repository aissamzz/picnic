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

/**
 * Header shared by every template: the cover photo as a banner (or the
 * template's own banner colour), the restaurant's logo top-left (its name
 * when there is no logo), language and info over the banner, then commune,
 * open status and table. Templates style it through the class props.
 */
export function BannerHeader({
  restaurant,
  labels,
  open,
  tableLabel,
  logoUrl,
  coverUrl,
  onInfo,
  langSwitch,
  fallbackClass,
  nameClass,
  fallbackNameClass,
  bodyClass,
  chipClass,
  statusClass,
  className,
  after,
}: import("./template-types").HeaderProps & {
  /** Banner background when there is no cover photo. */
  fallbackClass: string;
  /** Restaurant name (no logo), over the photo. */
  nameClass?: string;
  /** Restaurant name (no logo), over the fallback banner. */
  fallbackNameClass?: string;
  bodyClass?: string;
  chipClass?: string;
  statusClass?: string;
  className?: string;
  /** Decoration between the banner and the details (wave, band…). */
  after?: React.ReactNode;
}) {
  const hasCover = !!coverUrl;
  return (
    <header className={cn("relative", className)}>
      <div className={cn("relative overflow-hidden", hasCover ? "h-48" : cn("h-32", fallbackClass))}>
        {hasCover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- banner, first thing on screen */}
            <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/40" aria-hidden />
          </>
        )}
        <div className="relative flex items-start justify-between gap-3 px-4 pt-3">
          {logoUrl ? (
            <>
              <h1 className="sr-only">{restaurant.name}</h1>
              <span className="flex h-14 max-w-[55%] items-center rounded-2xl bg-white p-1.5 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element -- owner logo, any aspect ratio */}
                <img src={logoUrl} alt={restaurant.name} className="h-full w-auto max-w-full rounded-xl object-contain" />
              </span>
            </>
          ) : (
            <h1
              className={cn(
                "font-display min-w-0 pt-1.5 text-3xl leading-tight [overflow-wrap:anywhere]",
                hasCover ? cn("text-white drop-shadow-[0_1px_8px_rgba(0,0,0,.45)]", nameClass) : cn(nameClass, fallbackNameClass),
              )}
            >
              {restaurant.name}
            </h1>
          )}
          <div className="flex shrink-0 items-center gap-1 [&>*]:bg-black/40 [&>*]:text-white [&>*]:backdrop-blur-sm">
            {langSwitch}
            <InfoButton onClick={onInfo} labels={labels} />
          </div>
        </div>
      </div>
      {after}
      <div className={cn("flex flex-wrap items-center gap-2 px-4 pt-3", bodyClass)}>
        {restaurant.commune && <span className="text-sm text-m-muted">{restaurant.commune}</span>}
        <OpenStatus open={open} labels={labels} className={statusClass ?? "bg-m-surface"} />
        <TableChip label={tableLabel} className={cn("ms-auto", chipClass ?? "bg-m-accent text-m-on-accent")} />
      </div>
    </header>
  );
}
