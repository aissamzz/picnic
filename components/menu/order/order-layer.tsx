"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import * as React from "react";
import { APP_NAME } from "@/lib/config";
import { sessionId, trafficSource } from "@/lib/menu/beacon";
import { count as cartCount, setQty, subtotal, unitPrice, validLines, type CartLine } from "@/lib/menu/cart";
import { tx, type Lang, type MenuItem, type PublicMenu } from "@/lib/menu/types";
import { formatPrice } from "@/lib/price";
import { cx } from "@/lib/utils/cx";
import { normalizeDzPhone } from "@/lib/utils/phone";
import { buildOrderMessage, whatsappLink, type PlacedOrder } from "@/lib/whatsapp/message";
import { fmt, type MenuLabels } from "../labels";
import { MenuPrice } from "../menu-price";
import { Sheet } from "../sheet";
import { useCart } from "./cart-store";
import { QtyStepper } from "./stepper";

type Step = "closed" | "cart" | "checkout" | "sent";
type Customer = { name: string; phone: string; address: string; zoneId: string; note: string; mode: "delivery" | "takeaway" };

const CUSTOMER_KEY = "liinky:customer";
const SENT_KEY = "liinky:sent";

function loadCustomer(): Partial<Customer> {
  try {
    return JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Cart bar + cart, checkout and confirmation sheets for order links. */
export default function OrderLayer({ menu, lang, labels, closedNotice }: { menu: PublicMenu; lang: Lang; labels: MenuLabels; closedNotice: string | null }) {
  const r = menu.restaurant;
  const o = labels.order;
  const items = React.useMemo(() => new Map<string, MenuItem>(menu.categories.flatMap((c) => c.items.map((i) => [i.id, i] as const))), [menu.categories]);
  const [rawCart, setCart] = useCart(r.id);
  const cart = React.useMemo(() => validLines(rawCart, items), [rawCart, items]);
  const [step, setStep] = React.useState<Step>("closed");
  const [sent, setSent] = React.useState<{ id: string; link: string } | null>(null);

  // Lines that vanished from the menu (sold out, removed) leave the stored cart.
  React.useEffect(() => {
    if (cart.length !== rawCart.length) setCart(cart);
  }, [cart, rawCart, setCart]);

  // Back from WhatsApp: show the confirmation again.
  React.useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(`${SENT_KEY}:${r.id}`) ?? "null");
      if (s) {
        setSent(s);
        setStep("sent");
      }
    } catch {}
  }, [r.id]);

  const sub = subtotal(cart, items);
  const n = cartCount(cart);

  return (
    <>
      {n > 0 && step === "closed" && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setStep("cart")}
            className="flex min-h-14 w-full items-center gap-3 rounded-full bg-m-accent px-5 text-m-on-accent shadow-lg"
          >
            <span className="relative">
              <ShoppingBag className="size-6" aria-hidden />
              <span className="absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full bg-m-on-accent text-[11px] font-bold text-m-accent tabular">{n}</span>
            </span>
            <span className="flex-1 text-start font-bold">{o.viewCart}</span>
            <MenuPrice amount={sub} lang={lang} className="font-bold" />
          </button>
        </div>
      )}

      <Sheet open={step === "cart"} onClose={() => setStep("closed")} title={o.cart} closeLabel={labels.close} footer={cartFooter()}>
        {cart.length === 0 ? (
          <p className="py-8 text-center text-m-muted">{o.emptyCart}</p>
        ) : (
          <ul className="divide-y divide-m-line">
            {cart.map((l) => (
              <CartRow key={l.key} line={l} item={items.get(l.itemId)!} lang={lang} labels={labels} onQty={(q) => setCart(setQty(rawCart, l.key, q))} />
            ))}
          </ul>
        )}
      </Sheet>

      {step === "checkout" && (
        <Checkout
          menu={menu}
          cart={cart}
          items={items}
          lang={lang}
          labels={labels}
          onBack={() => setStep("cart")}
          onClose={() => setStep("closed")}
          onDropItem={(itemId) => setCart(rawCart.filter((l) => l.itemId !== itemId))}
          onSent={(s) => {
            setSent(s);
            setCart([]);
            try {
              sessionStorage.setItem(`${SENT_KEY}:${r.id}`, JSON.stringify(s));
            } catch {}
            setStep("sent");
            window.location.assign(s.link);
          }}
        />
      )}

      <Sheet
        open={step === "sent" && !!sent}
        onClose={() => {
          setStep("closed");
          try {
            sessionStorage.removeItem(`${SENT_KEY}:${r.id}`);
          } catch {}
        }}
        title={o.sentTitle}
        closeLabel={labels.close}
      >
        {sent && (
          <div className="flex flex-col gap-4 pt-2">
            <p>{fmt(o.sentBody, { id: sent.id })}</p>
            <a href={sent.link} className="flex min-h-12 items-center justify-center rounded-full bg-[#1F7A3D] px-4 font-bold text-white">
              {o.reopen}
            </a>
          </div>
        )}
      </Sheet>
    </>
  );

  function cartFooter() {
    if (cart.length === 0) return null;
    const missing = r.min_order - sub;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-semibold">
          <span>{o.subtotal}</span>
          <MenuPrice amount={sub} lang={lang} />
        </div>
        {missing > 0 && (
          <p role="status" className="text-sm text-m-muted">
            {fmt(o.missingForMin, { price: formatPrice(missing, lang) })}
          </p>
        )}
        {closedNotice ? (
          <p role="status" className="rounded-m bg-black/5 px-3 py-2 text-sm font-medium">
            {closedNotice}
          </p>
        ) : (
          <button
            type="button"
            disabled={missing > 0}
            onClick={() => setStep("checkout")}
            className="min-h-12 rounded-full bg-m-accent px-4 font-bold text-m-on-accent disabled:opacity-50"
          >
            {o.checkout}
          </button>
        )}
      </div>
    );
  }
}

function CartRow({ line, item, lang, labels, onQty }: { line: CartLine; item: MenuItem; lang: Lang; labels: MenuLabels; onQty: (q: number) => void }) {
  const variant = item.variants.find((v) => v.id === line.variantId);
  const extras = item.extras.filter((x) => line.extraIds.includes(x.id));
  const unit = unitPrice(item, line.variantId, line.extraIds) ?? 0;
  const name = tx(item.name, lang);
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {name}
          {variant && <span className="font-normal text-m-muted"> · {tx(variant.name, lang)}</span>}
        </p>
        {extras.length > 0 && <p className="text-sm text-m-muted">+ {extras.map((x) => tx(x.name, lang)).join(", ")}</p>}
        <MenuPrice amount={unit * line.qty} lang={lang} className="text-sm font-semibold" />
      </div>
      {line.qty === 1 ? (
        <button type="button" onClick={() => onQty(0)} aria-label={fmt(labels.order.remove, { name })} className="inline-flex size-11 items-center justify-center text-m-muted">
          <Trash2 className="size-5" />
        </button>
      ) : null}
      <QtyStepper value={line.qty} onChange={onQty} min={line.qty === 1 ? 1 : 0} labels={labels.order} label={`${labels.order.quantity} · ${name}`} />
    </li>
  );
}

function Checkout({
  menu,
  cart,
  items,
  lang,
  labels,
  onBack,
  onClose,
  onDropItem,
  onSent,
}: {
  menu: PublicMenu;
  cart: CartLine[];
  items: Map<string, MenuItem>;
  lang: Lang;
  labels: MenuLabels;
  onBack: () => void;
  onClose: () => void;
  onDropItem: (itemId: string) => void;
  onSent: (s: { id: string; link: string }) => void;
}) {
  const r = menu.restaurant;
  const o = labels.order;
  const modes = [...(r.delivery_enabled ? (["delivery"] as const) : []), ...(r.takeaway_enabled ? (["takeaway"] as const) : [])];
  const saved = React.useMemo(loadCustomer, []);
  const [c, setC] = React.useState<Customer>({
    name: saved.name ?? "",
    phone: saved.phone ?? "",
    address: saved.address ?? "",
    zoneId: saved.zoneId && menu.delivery_zones.some((z) => z.id === saved.zoneId) ? saved.zoneId : "",
    note: "",
    mode: saved.mode && modes.includes(saved.mode) ? saved.mode : modes[0],
  });
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const sub = subtotal(cart, items);
  const zone = menu.delivery_zones.find((z) => z.id === c.zoneId);
  const fee = c.mode === "delivery" ? (zone?.fee ?? 0) : 0;
  const set = (k: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setC((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phone = normalizeDzPhone(c.phone);
    if (c.name.trim().length < 2) return setError("invalid_name");
    if (!phone) return setError("invalid_phone");
    if (c.mode === "delivery" && !c.address.trim()) return setError("address_required");
    if (c.mode === "delivery" && menu.delivery_zones.length && !zone) return setError("zone_required");
    setSending(true);
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: c.name, phone: c.phone, address: c.address, zoneId: c.zoneId, mode: c.mode }));
    } catch {}
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${url}/rest/v1/rpc/submit_order`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_restaurant_id: r.id,
          p_order: {
            mode: c.mode,
            customer_name: c.name.trim(),
            customer_phone: phone,
            address: c.mode === "delivery" ? c.address.trim() : null,
            zone_id: c.mode === "delivery" ? c.zoneId || null : null,
            note: c.note.trim() || null,
            locale: lang,
            source: trafficSource("order", new URLSearchParams(window.location.search).get("src")),
            session_id: sessionId(),
            items: cart.map((l) => ({ item_id: l.itemId, variant_id: l.variantId, extra_ids: l.extraIds, qty: l.qty })),
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const code = String(body?.message ?? "generic");
        if (code === "item_unavailable" && body?.details) onDropItem(body.details);
        setError(code in o.errors ? code : "generic");
        return;
      }
      const placed = body as PlacedOrder;
      const text = buildOrderMessage(placed, { name: c.name.trim(), phone, address: c.mode === "delivery" ? c.address.trim() : null, note: c.note.trim() || null }, lang, labels.whatsapp, APP_NAME);
      onSent({ id: placed.public_id, link: whatsappLink(placed.whatsapp, text) });
    } catch {
      setError("generic");
    } finally {
      setSending(false);
    }
  }

  const field = "min-h-11 w-full rounded-m border border-m-line bg-m-surface px-3 text-[16px] text-m-fg focus:border-m-accent focus:outline-none";
  return (
    <Sheet
      open
      onClose={onClose}
      title={o.checkout}
      closeLabel={labels.close}
      footer={
        <div className="flex flex-col gap-2">
          {fee > 0 && (
            <>
              <div className="flex justify-between text-sm">
                <span>{o.subtotal}</span>
                <MenuPrice amount={sub} lang={lang} />
              </div>
              <div className="flex justify-between text-sm">
                <span>{o.deliveryFee}</span>
                <MenuPrice amount={fee} lang={lang} />
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>{o.total}</span>
            <MenuPrice amount={sub + fee} lang={lang} />
          </div>
          <p className="text-xs text-m-muted">{o.cash}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="min-h-12 rounded-full border border-m-line px-4 font-semibold">
              {labels.order.cart}
            </button>
            <button
              type="submit"
              form="checkout-form"
              disabled={sending}
              className="min-h-12 flex-1 rounded-full bg-[#1F7A3D] px-4 font-bold text-white disabled:opacity-60"
            >
              {sending ? o.sending : o.send}
            </button>
          </div>
        </div>
      }
    >
      <form id="checkout-form" onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
        {error && (
          <p role="alert" className="rounded-m bg-[#fdeaea] px-3 py-2 text-sm font-medium text-[#b42318]">
            {o.errors[error as keyof typeof o.errors] ?? o.errors.generic}
          </p>
        )}
        {modes.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{o.modeTitle}</legend>
            <div className="grid grid-cols-2 gap-2">
              {modes.map((m) => (
                <label key={m} className={cx("flex min-h-12 cursor-pointer items-center gap-2 rounded-m border px-3 font-semibold", c.mode === m ? "border-m-accent" : "border-m-line")}>
                  <input type="radio" name="mode" checked={c.mode === m} onChange={() => setC((s) => ({ ...s, mode: m }))} className="size-5 accent-[var(--m-accent)]" />
                  {o[m]}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {o.name}
          <input className={field} autoComplete="name" value={c.name} onChange={set("name")} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {o.phone}
          <span dir="ltr" className="flex">
            <span className="flex min-h-11 items-center rounded-s-[var(--m-radius)] border border-e-0 border-m-line px-3 text-m-muted">+213</span>
            <input
              className={cx(field, "rounded-s-none tabular")}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="555 12 34 56"
              value={c.phone}
              onChange={set("phone")}
              dir="ltr"
            />
          </span>
        </label>
        {c.mode === "delivery" && (
          <>
            {menu.delivery_zones.length > 0 && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                {o.zone}
                <select className={field} value={c.zoneId} onChange={set("zoneId")}>
                  <option value="">{o.zoneChoose}</option>
                  {menu.delivery_zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} · {formatPrice(z.fee, lang)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {o.address}
              <textarea className={cx(field, "min-h-20 py-2")} autoComplete="street-address" placeholder={o.addressPlaceholder} value={c.address} onChange={set("address")} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {o.note}
          <textarea className={cx(field, "min-h-16 py-2")} placeholder={o.notePlaceholder} value={c.note} onChange={set("note")} maxLength={300} />
        </label>
        {r.eta_label && <p className="text-sm text-m-muted">{fmt(o.eta, { eta: r.eta_label })}</p>}
      </form>
    </Sheet>
  );
}
