import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Price } from "@/components/ui/price";
import { APP_NAME, TABLE_SLUG_SUFFIX } from "@/lib/config";
import { getPublicMenu, resolveSlug, t as pick } from "@/lib/menu/public-menu";
import { parseMenuSegment } from "@/lib/slug";
import { publicImageUrl } from "@/lib/storage";

/**
 * TEMPORARY public menu (phase 2): proves the slug works end to end.
 * Phase 3 replaces the rendering with the 9 templates, ISR, cart and events.
 */
export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug: segment } = await params;
  const query = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => !!e[1]));
  const { slug, mode } = parseMenuSegment(decodeURIComponent(segment).toLowerCase());

  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();
  if (resolved.redirect) {
    const qs = query.toString();
    permanentRedirect(`/${resolved.slug}${mode === "table" ? TABLE_SLUG_SUFFIX : ""}${qs ? `?${qs}` : ""}`);
  }

  const menu = await getPublicMenu(resolved.slug);
  if (!menu) notFound();
  const tp = await getTranslations("public");
  const uiLocale = (await getLocale()) as "fr" | "ar";
  const locale = menu.restaurant.enabled_locales.includes(uiLocale) ? uiLocale : menu.restaurant.default_locale;
  const table = mode === "table" ? menu.tables.find((x) => x.code === query.get("t")) : undefined;
  const logo = publicImageUrl(menu.restaurant.logo_path);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col" data-mode={mode} data-template={menu.restaurant.template_key}>
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- temporary page, templates use next/image
          <img src={logo} alt="" className="size-12 rounded-full object-cover" />
        )}
        <div>
          <h1 className="text-xl font-bold">{menu.restaurant.name}</h1>
          {table && <p className="text-sm text-muted">{table.label}</p>}
        </div>
      </header>
      {menu.restaurant.is_paused ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <h2 className="text-lg font-semibold">{tp("paused")}</h2>
          <p className="text-muted">{tp("pausedBody")}</p>
        </main>
      ) : (
        <main className="flex flex-1 flex-col gap-6 px-4 py-6">
          {menu.categories.map((c) => (
            <section key={c.id} aria-labelledby={`c-${c.id}`}>
              <h2 id={`c-${c.id}`} className="mb-2 text-lg font-semibold">
                {pick(c.name, locale)}
              </h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {c.items.map((i) => (
                  <li key={i.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${i.is_sold_out ? "opacity-50" : ""}`}>
                    <span>{pick(i.name, locale)}</span>
                    {i.base_price != null && <Price amount={i.base_price} className="font-semibold" />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      )}
      <footer className="flex items-center justify-center gap-2 py-6 text-xs text-muted">
        <Logo compact className="scale-75" />
        {tp("poweredBy", { app: APP_NAME })}
      </footer>
    </div>
  );
}
