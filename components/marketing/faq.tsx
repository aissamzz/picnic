import { ChevronDown } from "lucide-react";

/** Native disclosure list: works without JavaScript. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <details key={it.q} className="group rounded-2xl bg-white px-4 open:pb-4">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="leading-relaxed text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
