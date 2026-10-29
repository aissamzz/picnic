"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cx as cn } from "@/lib/utils/cx";

/**
 * Bottom sheet on a native <dialog>: focus trap, Esc and inert background
 * for free, a few hundred bytes instead of a dialog library.
 */
export function Sheet({
  name,
  open,
  onClose,
  title,
  hideTitle,
  closeLabel,
  children,
  footer,
  className,
}: {
  /** Unique per page. Not useId: next/dynamic renders an extra server-only
   * sibling above the templates, so generated ids differ at hydration. */
  name: string;
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  closeLabel: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const id = `sheet-${name}-title`;
  // close() from our own effect also fires "close": only a user dismissal
  // (Esc) should reach onClose, or switching sheets would cancel itself.
  const openRef = React.useRef(open);
  openRef.current = open;

  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={cn("m-sheet", className)}
      onClose={() => {
        document.documentElement.style.overflow = "";
        if (openRef.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <h2 id={id} className={cn("font-display text-xl leading-tight font-bold", hideTitle && "sr-only")}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="-me-2 -mt-1 ms-auto inline-flex size-11 shrink-0 items-center justify-center rounded-full text-m-muted hover:bg-black/5"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="border-t border-m-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
