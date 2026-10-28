import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const inputClass =
  "min-h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-sand disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Content rendered inside the field at the inline start (icon, prefix). */
  start?: React.ReactNode;
  /** Content rendered inside the field at the inline end (unit, button). */
  end?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, start, end, ...props }, ref) => {
  if (!start && !end) return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  return (
    <div className="relative flex items-center">
      {start && <span className="pointer-events-none absolute start-3 flex items-center text-muted">{start}</span>}
      <input ref={ref} className={cn(inputClass, start && "ps-10", end && "pe-12", className)} {...props} />
      {end && <span className="absolute end-1 flex items-center text-muted">{end}</span>}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, "min-h-24 py-2.5 leading-normal", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, "appearance-none pe-10", className)} {...props} />
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  ),
);
Select.displayName = "Select";
