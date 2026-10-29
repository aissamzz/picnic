"use client";

import { Minus, Plus } from "lucide-react";

/** Quantity − n + with 44px targets. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  labels,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  labels: { decrease: string; increase: string };
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-full border border-m-line">
      <button type="button" className="inline-flex size-11 items-center justify-center disabled:opacity-40" aria-label={labels.decrease} onClick={() => onChange(value - 1)} disabled={value <= min}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-8 text-center font-bold tabular" aria-live="polite">
        {value}
      </span>
      <button type="button" className="inline-flex size-11 items-center justify-center disabled:opacity-40" aria-label={labels.increase} onClick={() => onChange(value + 1)} disabled={value >= 50}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
