"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** On/off switch. Wrapped in a 44px hit area; thumb flips side in RTL. */
export const Toggle = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent bg-line transition-colors",
      "before:absolute before:-inset-2 before:content-['']",
      "data-[state=checked]:bg-primary disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-6 rounded-full bg-white shadow transition-transform",
        "translate-x-0 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
      )}
    />
  </SwitchPrimitive.Root>
));
Toggle.displayName = "Toggle";
