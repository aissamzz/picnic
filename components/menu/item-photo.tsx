import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";
import { cx as cn } from "@/lib/utils/cx";

/**
 * Item photo via next/image (width presets, lazy), or a themed placeholder
 * with the dish initial when there is no photo.
 */
export function ItemPhoto({
  path,
  name,
  sizes,
  className,
  priority,
  placeholderClassName,
}: {
  path?: string | null;
  name: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  placeholderClassName?: string;
}) {
  const src = publicImageUrl(path);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div
          aria-hidden
          className={cn(
            "font-display flex size-full items-center justify-center bg-[color-mix(in_srgb,var(--m-accent)_18%,var(--m-surface))] text-[min(2.5rem,40cqw)] text-m-accent [container-type:size]",
            placeholderClassName,
          )}
        >
          {Array.from(name.trim())[0]?.toUpperCase() ?? "•"}
        </div>
      )}
    </div>
  );
}
