"use client";

import { Toaster as Sonner, toast } from "sonner";

export function Toaster({ dir }: { dir: "ltr" | "rtl" }) {
  return (
    <Sonner
      dir={dir}
      position="bottom-center"
      offset={88}
      mobileOffset={88}
      toastOptions={{
        classNames: {
          toast: "!rounded-md !border-0 !bg-ink !text-white !shadow-sheet !font-[inherit]",
          actionButton: "!min-h-9 !rounded-md !bg-transparent !px-3 !font-semibold !text-accent",
          description: "!text-white/80",
        },
      }}
    />
  );
}

/**
 * Toast with an Undo action. `onUndo` runs if tapped within `duration`.
 * Labels come from the caller so they stay translated.
 */
export function toastWithUndo(
  message: string,
  { undoLabel, onUndo, duration = 5000 }: { undoLabel: string; onUndo: () => void; duration?: number },
) {
  return toast(message, { duration, action: { label: undoLabel, onClick: onUndo } });
}

export { toast };
