"use client";

import { Heart } from "lucide-react";
import * as React from "react";
import { cx as cn } from "@/lib/utils/cx";
import type { TabsProps } from "./template-types";

type Variant = "pill" | "underline" | "square";

/** Sticky, horizontally scrolling category tabs; keeps the active one in view. */
export function DefaultTabs({ variant = "pill", className, ...p }: TabsProps & { variant?: Variant; className?: string }) {
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [p.active]);

  const base =
    variant === "underline"
      ? "min-h-11 border-b-2 px-3 text-sm font-semibold"
      : variant === "square"
        ? "min-h-11 rounded-md border px-3 text-sm font-semibold"
        : "min-h-11 rounded-full border px-4 text-sm font-semibold";
  const on = variant === "underline" ? "border-m-accent text-m-fg" : "border-m-accent bg-m-accent text-m-on-accent";
  const off = variant === "underline" ? "border-transparent text-m-muted" : "border-m-line text-m-fg";

  return (
    <nav aria-label={p.labels.categories} className={cn("sticky top-0 z-20 bg-m-bg/95 backdrop-blur", className)}>
      <div ref={listRef} className={cn("no-scrollbar flex gap-2 overflow-x-auto px-4 py-2", variant === "underline" && "gap-0 border-b border-m-line py-0")}>
        {p.favoritesCount > 0 && (
          <button
            type="button"
            aria-pressed={p.favoritesOnly}
            onClick={p.onToggleFavorites}
            className={cn(base, "inline-flex shrink-0 items-center gap-1.5", p.favoritesOnly ? on : off)}
          >
            <Heart className={cn("size-4", p.favoritesOnly && "fill-current")} aria-hidden />
            {p.labels.favorites}
            <span className="tabular opacity-70">{p.favoritesCount}</span>
          </button>
        )}
        {p.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-current={p.active === c.id ? "true" : undefined}
            onClick={() => p.onSelect(c.id)}
            className={cn(base, "shrink-0 whitespace-nowrap", p.active === c.id ? on : off)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
