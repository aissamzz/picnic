import { cx as cn } from "@/lib/utils/cx";

/**
 * Thin Kabyle-style band: a row of triangles over a checkerboard strip,
 * in ink, sand and clay. Brand moments only (landing hero edge, printed
 * stands, "you're live", empty states).
 */
export function KabyleBand({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("block h-4 w-full", className)}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="kabyle-band" width="24" height="16" patternUnits="userSpaceOnUse">
          <rect width="24" height="16" fill="var(--sand)" />
          <path d="M0 10 L6 2 L12 10 Z" fill="var(--clay)" />
          <path d="M12 10 L18 2 L24 10 Z" fill="var(--ink)" />
          <path d="M6 2 L9 6 L3 6 Z" fill="var(--sand)" />
          <rect x="0" y="11" width="3" height="2.5" fill="var(--ink)" />
          <rect x="6" y="11" width="3" height="2.5" fill="var(--ink)" />
          <rect x="12" y="11" width="3" height="2.5" fill="var(--clay)" />
          <rect x="18" y="11" width="3" height="2.5" fill="var(--ink)" />
          <rect x="3" y="13.5" width="3" height="2.5" fill="var(--clay)" />
          <rect x="9" y="13.5" width="3" height="2.5" fill="var(--ink)" />
          <rect x="15" y="13.5" width="3" height="2.5" fill="var(--ink)" />
          <rect x="21" y="13.5" width="3" height="2.5" fill="var(--clay)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kabyle-band)" />
    </svg>
  );
}
