"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { inputClass } from "./input";

/** 6-digit one-time code: big, spaced, numeric keyboard, paste-friendly. */
export const CodeInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }
>(({ value, onChange, className, ...props }, ref) => (
  <input
    ref={ref}
    type="text"
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9]*"
    maxLength={6}
    dir="ltr"
    value={value}
    onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
    className={cn(inputClass, "min-h-14 text-center text-2xl font-bold tracking-[0.5em] tabular", className)}
    {...props}
  />
));
CodeInput.displayName = "CodeInput";
