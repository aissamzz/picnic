import { Flame, Leaf, Sparkles, Star } from "lucide-react";
import type { ItemTag } from "@/lib/menu/types";
import { cx as cn } from "@/lib/utils/cx";
import type { MenuLabels } from "./labels";

const ICONS: Partial<Record<ItemTag, typeof Flame>> = { new: Sparkles, spicy: Flame, vegetarian: Leaf, best_seller: Star };

/** New / best seller / spicy / vegetarian chips (plat du jour has its own slot). */
export function TagBadges({ tags, labels, className, tone = "soft" }: { tags: ItemTag[]; labels: MenuLabels; className?: string; tone?: "soft" | "solid" }) {
  const shown = tags.filter((t) => t !== "dish_of_day");
  if (!shown.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((t) => {
        const Icon = ICONS[t];
        return (
          <span
            key={t}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold",
              tone === "solid" ? "bg-m-accent text-m-on-accent" : "bg-[color-mix(in_srgb,var(--m-accent)_16%,transparent)] text-m-fg",
            )}
          >
            {Icon && <Icon className="size-3" aria-hidden />}
            {labels.tags[t]}
          </span>
        );
      })}
    </span>
  );
}

export function SoldOutBadge({ label, className }: { label: string; className?: string }) {
  return <span className={cn("inline-flex rounded-full bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white", className)}>{label}</span>;
}
