"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import { APP_NAME } from "@/lib/config";
import { logMenuEvent, trafficSource } from "@/lib/menu/beacon";
import { isScheduleActive, openState, type OpenState } from "@/lib/menu/hours";
import { tx, type Lang, type MenuItem, type MenuMode, type PublicMenu } from "@/lib/menu/types";
import { publicImageUrl } from "@/lib/storage";
import { cx as cn } from "@/lib/utils/cx";
import { DefaultDishOfDay } from "./dish-of-day";
import { InfoSheetBody } from "./info-sheet";
import { fmt, type MenuLabels } from "./labels";
import { LangSwitch } from "./lang-switch";
import { Sheet } from "./sheet";
import type { TemplateParts } from "./template-types";

// Loaded only where needed: table links never download the cart, order links never the waiter call.
const OrderLayer = dynamic(() => import("./order/order-layer"));
const ItemControls = dynamic(() => import("./order/item-controls"));
const WaiterCall = dynamic(() => import("./order/waiter-call"));

export type MenuAppProps = {
  menu: PublicMenu;
  lang: Lang;
  mode: MenuMode;
  labels: MenuLabels;
  /** Owner preview: no analytics, language switch navigates instead of reloading. */
  preview?: { langHref: Record<Lang, string> };
};

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .toLowerCase();

function useFavorites(restaurantId: string) {
  const key = `liinky:fav:${restaurantId}`;
  const [favs, setFavs] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      /* storage unavailable: favorites just won't persist */
    }
  }, [key]);
  const toggle = (id: string) =>
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return { favs, toggle };
}

/** Shared behaviour of every template; the template only draws. */
export function MenuApp({ menu, lang, mode, labels, preview, parts }: MenuAppProps & { parts: TemplateParts }) {
  const r = menu.restaurant;
  const { favs, toggle } = useFavorites(r.id);
  const [query, setQuery] = React.useState("");
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [selected, setSelected] = React.useState<MenuItem | null>(null);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const offline = useOffline();
  const [active, setActive] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<OpenState | null>(null);
  const [table, setTable] = React.useState<{ code: string; label: string } | null>(null);
  const tableLabel = table?.label ?? null;
  const [inactiveSchedules, setInactiveSchedules] = React.useState<Set<string>>(new Set());
  const viewed = React.useRef(new Set<string>());

  // Device-side state: time-dependent bits and the URL query (the HTML is cached).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("t");
    const table = mode === "table" && code ? menu.tables.find((t) => t.code.toLowerCase() === code.toLowerCase()) : undefined;
    setTable(table ? { code: table.code, label: table.label } : null);
    const tick = () => {
      setOpen(openState(menu.hours, menu.exceptions, r.timezone));
      setInactiveSchedules(new Set(menu.schedules.filter((s) => !isScheduleActive(s, r.timezone)).map((s) => s.id)));
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    if (!preview) {
      logMenuEvent({
        restaurantId: r.id,
        kind: mode === "table" ? "view_table" : "view_order",
        source: trafficSource(mode, params.get("src")),
        tableCode: table?.code ?? null,
      });
    }
    return () => window.clearInterval(id);
  }, [menu, mode, r.id, r.timezone, preview]);

  const categories = React.useMemo(
    () =>
      menu.categories
        .filter((c) => !c.schedule_id || !inactiveSchedules.has(c.schedule_id))
        .map((c) => ({ ...c, items: favoritesOnly ? c.items.filter((i) => favs.includes(i.id)) : c.items }))
        .filter((c) => c.items.length > 0),
    [menu.categories, inactiveSchedules, favoritesOnly, favs],
  );
  const allItems = React.useMemo(() => menu.categories.flatMap((c) => c.items), [menu.categories]);
  const dishOfDay = allItems.filter((i) => i.tags.includes("dish_of_day") && !i.is_sold_out);
  const q = normalize(query.trim());
  const results = q
    ? allItems.filter((i) => normalize([tx(i.name, "fr"), tx(i.name, "ar"), tx(i.description, lang)].join(" ")).includes(q))
    : null;

  // Scrollspy: the section crossing the top area is the active tab.
  React.useEffect(() => {
    if (results) return;
    const sections = categories.map((c) => document.getElementById(`cat-${c.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.slice(4));
      },
      { rootMargin: "-72px 0px -65% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    setActive((a) => a ?? categories[0]?.id ?? null);
    return () => io.disconnect();
  }, [categories, results]);

  const openItem = (item: MenuItem) => {
    setSelected(item);
    if (!preview && !viewed.current.has(item.id)) {
      viewed.current.add(item.id);
      logMenuEvent({ restaurantId: r.id, kind: "item_view", source: trafficSource(mode, new URLSearchParams(window.location.search).get("src")), itemId: item.id });
    }
  };

  const hideCurrency = !!parts.hideCurrencyOnItems;
  const ordering = mode === "order" && r.ordering_available && !r.is_paused && !preview;
  const waiter = mode === "table" && !!table && !r.is_paused && !preview;
  const closedNotice =
    open && open.hasHours && !open.open ? (open.opensAt ? fmt(labels.order.closedNow, { time: open.opensAt }) : labels.order.closedNoTime) : null;
  const card = (item: MenuItem, index: number) => (
    <parts.ItemCard
      key={item.id}
      item={item}
      name={tx(item.name, lang)}
      description={tx(item.description, lang)}
      lang={lang}
      labels={labels}
      onOpen={() => openItem(item)}
      isFavorite={favs.includes(item.id)}
      hideCurrency={hideCurrency}
      index={index}
    />
  );
  const SectionHeader = parts.SectionHeader ?? DefaultSectionHeader;
  const DishOfDay = parts.DishOfDay ?? DefaultDishOfDay;
  // An owner color replaces the accent; palette colors all take white text.
  const themeStyle = { ...parts.theme, ...(r.primary_color ? { "--m-accent": r.primary_color, "--m-on-accent": "#FFFFFF" } : {}) } as React.CSSProperties;

  return (
    <div className={cn("menu-root min-h-dvh", ordering || waiter ? "pb-28" : "pb-10", parts.rootClass)} style={themeStyle} data-template={r.template_key} data-mode={mode}>
      {offline && (
        <p role="status" className="bg-black px-4 py-2 text-center text-sm text-white">
          {labels.offline}
        </p>
      )}
      <parts.Header
        restaurant={r}
        lang={lang}
        labels={labels}
        open={open}
        tableLabel={tableLabel}
        logoUrl={publicImageUrl(r.logo_path)}
        coverUrl={publicImageUrl(r.cover_path)}
        onInfo={() => setInfoOpen(true)}
        langSwitch={
          <LangSwitch
            lang={lang}
            langs={r.enabled_locales}
            label={labels.language}
            onChange={preview ? (l) => window.location.assign(preview.langHref[l]) : undefined}
          />
        }
      />

      {r.is_paused ? (
        <div className="mx-4 mt-6 rounded-m border border-m-line bg-m-surface p-6 text-center">
          <h2 className="font-display text-xl font-bold">{labels.paused}</h2>
          <p className="mt-1 text-m-muted">{labels.pausedBody}</p>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4">
            <label className="relative flex items-center">
              <span className="sr-only">{labels.search}</span>
              <Search className="pointer-events-none absolute start-3 size-5 text-m-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.searchPlaceholder}
                className="min-h-11 w-full rounded-full border border-m-line bg-m-surface ps-10 pe-10 text-[16px] text-m-fg placeholder:text-m-muted focus:border-m-accent focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label={labels.clearSearch} className="absolute end-1 inline-flex size-10 items-center justify-center text-m-muted">
                  <X className="size-5" />
                </button>
              )}
            </label>
          </div>

          {results ? (
            <section aria-live="polite" className="px-4 pt-4">
              {results.length === 0 ? (
                <p className="py-10 text-center text-m-muted">{fmt(labels.noResults, { query })}</p>
              ) : (
                <div className={parts.listClass}>{results.map(card)}</div>
              )}
            </section>
          ) : (
            <>
              {dishOfDay.length > 0 && !favoritesOnly && <DishOfDay items={dishOfDay} lang={lang} labels={labels} onOpen={openItem} hideCurrency={hideCurrency} />}
              <parts.CategoryTabs
                categories={categories.map((c) => ({ id: c.id, name: tx(c.name, lang), count: c.items.length }))}
                active={active}
                onSelect={(id) => {
                  setActive(id);
                  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                favoritesCount={favs.filter((f) => allItems.some((i) => i.id === f)).length}
                favoritesOnly={favoritesOnly}
                onToggleFavorites={() => setFavoritesOnly((v) => !v)}
                labels={labels}
              />
              {categories.length === 0 && <p className="px-4 py-16 text-center text-m-muted">{labels.empty}</p>}
              {categories.map((c, ci) => (
                <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`cat-${c.id}-title`} className="scroll-mt-16 px-4 pt-6">
                  <SectionHeader title={tx(c.name, lang)} count={c.items.length} index={ci} labels={labels} />
                  <div className={parts.listClass}>{c.items.map(card)}</div>
                </section>
              ))}
            </>
          )}
        </>
      )}

      <footer className="mt-10 flex flex-col items-center gap-1 px-4 text-center text-xs text-m-muted">
        {hideCurrency && <p>{labels.priceNote}</p>}
        {r.show_powered_by && (
          <Link href="/" className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            {fmt(labels.poweredBy, { app: APP_NAME })}
          </Link>
        )}
      </footer>

      <Sheet name="item" open={!!selected} onClose={() => setSelected(null)} title={selected ? tx(selected.name, lang) : ""} closeLabel={labels.close}>
        {selected && (
          <parts.ItemSheet
            item={selected}
            lang={lang}
            labels={labels}
            isFavorite={favs.includes(selected.id)}
            onToggleFavorite={() => toggle(selected.id)}
            hideCurrency={hideCurrency}
            orderable={ordering}
          />
        )}
        {selected && ordering && (
          <ItemControls
            key={selected.id}
            item={selected}
            restaurantId={r.id}
            lang={lang}
            labels={labels}
            closedNotice={closedNotice}
            onAdded={() => setSelected(null)}
          />
        )}
      </Sheet>
      {ordering && <OrderLayer menu={menu} lang={lang} labels={labels} closedNotice={closedNotice} />}
      {waiter && <WaiterCall restaurantId={r.id} tableCode={table!.code} labels={labels} />}
      <Sheet name="info" open={infoOpen} onClose={() => setInfoOpen(false)} title={r.name} closeLabel={labels.close}>
        <InfoSheetBody menu={menu} labels={labels} />
      </Sheet>
    </div>
  );
}

function DefaultSectionHeader({ title }: { title: string }) {
  return <h2 className="font-display mb-3 text-xl font-bold">{title}</h2>;
}

/** True while the device is offline (the page then comes from the service worker cache). */
function useOffline() {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}
