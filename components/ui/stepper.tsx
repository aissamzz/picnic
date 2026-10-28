import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type StepperProps = {
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  /** Accessible label, e.g. "Étape 3 sur 7". */
  label: string;
  className?: string;
};

/** Compact progress for onboarding: segments on mobile, labels from sm up. */
export function Stepper({ steps, current, label, className }: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex items-center gap-1.5">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className="flex flex-1 flex-col gap-1.5" aria-current={active ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full", done || active ? "bg-primary" : "bg-line")} />
              <span
                className={cn(
                  "hidden items-center gap-1 text-xs sm:flex",
                  active ? "font-semibold text-ink" : done ? "text-primary" : "text-muted",
                )}
              >
                {done && <Check className="size-3.5" aria-hidden />}
                {step}
              </span>
              <span className="sr-only sm:hidden">{step}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
