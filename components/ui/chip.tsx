import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Selectable pill (filters, category tabs, options). */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(({ selected, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={selected}
    className={cn(
      "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors [&_svg]:size-4",
      selected ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:bg-sand",
      className,
    )}
    {...props}
  />
));
Chip.displayName = "Chip";
