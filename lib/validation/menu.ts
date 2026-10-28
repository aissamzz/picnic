import { z } from "zod";
import { parsePrice } from "@/lib/price";
import { bilingualName } from "./onboarding";

export const ITEM_TAGS = ["new", "best_seller", "spicy", "vegetarian", "dish_of_day"] as const;

/** Optional {fr, ar} text (descriptions): empty strings dropped. */
export const bilingualText = z
  .object({ fr: z.string().trim().max(400).optional().default(""), ar: z.string().trim().max(400).optional().default("") })
  .transform((v) => ({ ...(v.fr ? { fr: v.fr } : {}), ...(v.ar ? { ar: v.ar } : {}) }));

const requiredPrice = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const p = parsePrice(v);
  if (p === null) {
    ctx.addIssue({ code: "custom", message: "errors.priceInvalid" });
    return z.NEVER;
  }
  return p;
});

const optionalPrice = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return null;
    const p = parsePrice(v);
    if (p === null) {
      ctx.addIssue({ code: "custom", message: "errors.priceInvalid" });
      return z.NEVER;
    }
    return p;
  });

/** Extras may be free (0 DA). */
const extraPrice = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "" || v === 0 || v === "0") return 0;
    const p = parsePrice(v);
    if (p === null) {
      ctx.addIssue({ code: "custom", message: "errors.priceInvalid" });
      return z.NEVER;
    }
    return p;
  });

export const itemSchema = z.object({
  id: z.guid().optional(),
  categoryId: z.guid(),
  name: bilingualName,
  description: bilingualText,
  basePrice: optionalPrice,
  tags: z.array(z.enum(ITEM_TAGS)).max(5).default([]),
  isSoldOut: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  photos: z.array(z.string().max(200)).max(4).default([]),
  variants: z.array(z.object({ name: bilingualName, price: requiredPrice })).max(10).default([]),
  extras: z.array(z.object({ name: bilingualName, price: extraPrice })).max(20).default([]),
});

export const categorySchema = z.object({
  id: z.guid().optional(),
  name: bilingualName,
  isVisible: z.boolean().default(true),
  scheduleId: z.guid().nullable().optional(),
});
