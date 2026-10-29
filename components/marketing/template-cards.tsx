import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TEMPLATE_KEYS } from "@/lib/templates/meta";

/** The 9 demo menus as photo cards linking to /template-N. */
export async function TemplateCards({ layout = "row" }: { layout?: "row" | "grid" }) {
  const tt = await getTranslations("templates");
  const t = await getTranslations("marketing.demo");
  return (
    <ul className={layout === "row" ? "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
      {TEMPLATE_KEYS.map((key, i) => (
        <li key={key} className={layout === "row" ? "w-44 shrink-0 snap-start" : ""}>
          <Link
            href={`/template-${i + 1}`}
            aria-label={t("open", { name: tt(`${key}.name`) })}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-md"
          >
            <span className="relative block aspect-[4/5] overflow-hidden">
              <Image src={`/templates/photos/banner-${key}.webp`} alt="" fill sizes="(max-width: 640px) 50vw, 260px" className="object-cover transition-transform group-hover:scale-105" />
            </span>
            <span className="flex flex-col gap-0.5 p-3">
              <span className="font-bold">{tt(`${key}.name`)}</span>
              <span className="text-sm text-muted">{tt(`${key}.desc`)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
