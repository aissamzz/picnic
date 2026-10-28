"use client";

import * as React from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils/cn";

type BottomSheetProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  title: React.ReactNode;
  /** Visually hide the title (it stays available to screen readers). */
  hideTitle?: boolean;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/** Mobile-first modal surface: slides up from the bottom, drag to dismiss. */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  hideTitle,
  description,
  footer,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-xl bg-surface shadow-sheet outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden />
          <div className={cn("px-5 pt-3 pb-2", hideTitle && "sr-only")}>
            <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-1 text-sm text-muted">{description}</Drawer.Description>}
          </div>
          {!description && <Drawer.Description className="sr-only">{title}</Drawer.Description>}
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && (
            <div className="border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
