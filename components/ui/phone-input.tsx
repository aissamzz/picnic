"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { inputClass } from "./input";

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** National significant number without the leading 0, e.g. "555123456". */
  value: string;
  onChange: (nationalNumber: string) => void;
}

/** Strips everything but digits and removes a leading 0 / 213 / 00213 prefix. */
export function toNationalNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00213")) d = d.slice(5);
  else if (d.startsWith("213") && d.length > 9) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}

function group(n: string) {
  // 555 12 34 56
  return [n.slice(0, 3), n.slice(3, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean).join(" ");
}

/**
 * +213 phone field. Accepts "0555…" (leading 0 stripped) and pasted
 * international formats. Always LTR, even inside Arabic UI.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, className, ...props }, ref) => (
    <div dir="ltr" className="flex items-stretch">
      <span className="flex min-h-11 items-center rounded-s-md border border-e-0 border-line bg-sand px-3 text-[15px] font-medium text-muted tabular">
        +213
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        className={cn(inputClass, "rounded-s-none tabular", className)}
        placeholder="555 12 34 56"
        value={group(value)}
        onChange={(e) => onChange(toNationalNumber(e.target.value))}
        {...props}
      />
    </div>
  ),
);
PhoneInput.displayName = "PhoneInput";
