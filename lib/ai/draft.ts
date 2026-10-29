import { parsePrice } from "@/lib/price";
import type { Extraction } from "./schema";

export type I18n = { fr: string; ar: string };
export type DraftVariant = { name: I18n; price: number | null };
export type DraftItem = {
  key: string;
  name: I18n;
  description: I18n;
  price: number | null;
  variants: DraftVariant[];
  /** Fields the owner should double-check (shown in orange). */
  check: { name: boolean; price: boolean };
};
export type DraftCategory = { key: string; name: I18n; items: DraftItem[] };
export type ImportDraft = { partial: boolean; categories: DraftCategory[] };

/** Below this the model itself wasn't sure. */
export const LOW_CONFIDENCE = 0.7;

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
const i18n = (v: { fr: string | null; ar: string | null } | null | undefined): I18n => ({ fr: clean(v?.fr), ar: clean(v?.ar) });

/** Accent-, case- and spacing-insensitive name key; Arabic alef/ya/ta marbuta variants folded. */
export function nameKey(name: I18n): string {
  const fr = name.fr
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (fr) return `fr:${fr}`;
  const ar = name.ar
    .replace(/[ً-ْـ]/g, "") // diacritics, tatweel
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
  return ar ? `ar:${ar}` : "";
}

/**
 * Turns the model's output into an editable draft: prices parsed by our own
 * rules ("1.100", "11 00", "١٢٠٠ دج"), doubtful fields flagged, sections with
 * the same name (repeated across photos) folded together.
 */
export function toDraft(x: Extraction): ImportDraft {
  let n = 0;
  const key = () => `k${++n}`;
  const byName = new Map<string, DraftCategory>();
  const categories: DraftCategory[] = [];

  for (const c of x.categories) {
    const name = i18n(c.name);
    const items = c.items
      .map((it): DraftItem | null => {
        const itemName = i18n(it.name);
        if (!itemName.fr && !itemName.ar) return null;
        const variants = it.variants
          .map((v) => ({ name: i18n(v.name), price: parsePrice(v.price_text) }))
          .filter((v) => v.name.fr || v.name.ar);
        const price = variants.length ? null : parsePrice(it.price_text);
        const unparsed = (!variants.length && it.price_text != null && price == null) || variants.some((v) => v.price == null);
        const missing = !variants.length && price == null;
        return {
          key: key(),
          name: itemName,
          description: i18n(it.description),
          price,
          variants,
          check: {
            name: it.confidence.name < LOW_CONFIDENCE,
            price: it.confidence.price < LOW_CONFIDENCE || unparsed || missing,
          },
        };
      })
      .filter((i): i is DraftItem => i !== null);
    if (!items.length) continue;

    const k = nameKey(name);
    const existing = k ? byName.get(k) : undefined;
    if (existing) {
      existing.items.push(...items);
      existing.name = fillMissing(existing.name, name);
      continue;
    }
    const cat = { key: key(), name: name.fr || name.ar ? name : { fr: "Menu", ar: "" }, items };
    if (k) byName.set(k, cat);
    categories.push(cat);
  }
  return { partial: x.problem === "partial", categories };
}

function fillMissing(a: I18n, b: I18n): I18n {
  return { fr: a.fr || b.fr, ar: a.ar || b.ar };
}

/** Item key -> key of the first item with the same name (anywhere in the draft). */
export function findDuplicates(draft: ImportDraft): Map<string, string> {
  const first = new Map<string, string>();
  const dupes = new Map<string, string>();
  for (const c of draft.categories)
    for (const i of c.items) {
      const k = nameKey(i.name);
      if (!k) continue;
      const f = first.get(k);
      if (f) dupes.set(i.key, f);
      else first.set(k, i.key);
    }
  return dupes;
}

/**
 * Folds `dupKey` into `keepKey`: missing languages, description and price are
 * taken from the duplicate, sizes are merged by name. The duplicate is removed.
 */
export function mergeItems(draft: ImportDraft, keepKey: string, dupKey: string): ImportDraft {
  const dup = draft.categories.flatMap((c) => c.items).find((i) => i.key === dupKey);
  if (!dup) return draft;
  return {
    ...draft,
    categories: draft.categories
      .map((c) => ({
        ...c,
        items: c.items
          .filter((i) => i.key !== dupKey)
          .map((i) => {
            if (i.key !== keepKey) return i;
            const variants = [...i.variants];
            for (const v of dup.variants) if (!variants.some((x) => nameKey(x.name) === nameKey(v.name))) variants.push(v);
            const price = variants.length ? null : (i.price ?? dup.price);
            return {
              ...i,
              name: fillMissing(i.name, dup.name),
              description: fillMissing(i.description, dup.description),
              price,
              variants,
              check: { name: i.check.name && dup.check.name, price: variants.length ? i.check.price : price == null },
            };
          }),
      }))
      .filter((c) => c.items.length > 0),
  };
}

export function countItems(draft: ImportDraft): number {
  return draft.categories.reduce((n, c) => n + c.items.length, 0);
}

/** Payload for apply_ai_import (keys and flags dropped). */
export function toApplyPayload(draft: ImportDraft) {
  return {
    categories: draft.categories.map((c) => ({
      name: c.name,
      items: c.items.map((i) => ({ name: i.name, description: i.description, price: i.variants.length ? null : i.price, variants: i.variants })),
    })),
  };
}
