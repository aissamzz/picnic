import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

/**
 * The Liinky logo, from the brand kit (public/brand, see brand/logo/GUIDELINES.md
 * in the brand repo). Never retype the name as text in its place.
 * - horizontal: headers and nav (reversed on dark backgrounds), min 96 px wide
 * - stacked: login, signup and splash screens, min 64 px wide
 * - symbol: small square marks, min 32 px (below that the small symbol is used)
 */
const FILES = {
  horizontal: { src: "/brand/liinky-horizontal.svg", w: 696, h: 250 },
  reversed: { src: "/brand/liinky-horizontal-reversed.svg", w: 696, h: 250 },
  stacked: { src: "/brand/liinky-stacked.svg", w: 546, h: 496 },
  symbol: { src: "/brand/liinky-symbol.svg", w: 256, h: 256 },
  "symbol-small": { src: "/brand/liinky-symbol-small.svg", w: 256, h: 256 },
  "symbol-white": { src: "/brand/liinky-symbol-white.svg", w: 256, h: 256 },
} as const;

export type LogoVariant = keyof typeof FILES;

export function Logo({
  variant = "horizontal",
  height,
  className,
  decorative,
}: {
  variant?: LogoVariant;
  /** Rendered height in px (width follows the artwork). */
  height?: number;
  className?: string;
  /** Next to visible text naming Liinky: hide from screen readers. */
  decorative?: boolean;
}) {
  const f = FILES[variant === "symbol" && height != null && height < 32 ? "symbol-small" : variant];
  const h = height ?? (variant === "stacked" ? 110 : variant.startsWith("symbol") ? 32 : 36);
  const w = Math.round((f.w / f.h) * h);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG artwork, no optimisation needed
    <img src={f.src} alt={decorative ? "" : APP_NAME} width={w} height={h} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}
