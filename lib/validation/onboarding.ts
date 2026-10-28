import { z } from "zod";
import { RESTAURANT_TYPES } from "@/lib/dz/restaurant-types";
import { parsePrice } from "@/lib/price";
import { isWellFormedSlug } from "@/lib/slug";
import { TEMPLATE_KEYS } from "@/lib/templates/meta";
import { normalizeDzPhone } from "@/lib/utils/phone";

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const e164 = normalizeDzPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "errors.phoneInvalid" });
      return z.NEVER;
    }
    return e164;
  });

export const infoSchema = z.object({
  name: z.string().trim().min(1, "errors.required").max(80),
  slug: z.string().trim().toLowerCase().refine(isWellFormedSlug, "errors.slugInvalid"),
  type: z.enum(RESTAURANT_TYPES),
  wilayaCode: z.coerce.number<string | number>().int().min(1, "errors.required").max(58),
  commune: z.string().trim().max(80).optional().default(""),
  address: z.string().trim().max(160).optional().default(""),
  whatsapp: optionalPhone,
});

export const templateSchema = z.object({ templateKey: z.enum(TEMPLATE_KEYS) });

/** {fr, ar} with at least one filled. Empty strings are dropped. */
export const bilingualName = z
  .object({ fr: z.string().trim().max(80).optional().default(""), ar: z.string().trim().max(80).optional().default("") })
  .refine((v) => v.fr || v.ar, { message: "errors.nameOneLanguage", path: ["fr"] })
  .transform((v) => ({ ...(v.fr ? { fr: v.fr } : {}), ...(v.ar ? { ar: v.ar } : {}) }));

export const priceInput = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return null;
    const p = parsePrice(v);
    if (p === null) {
      ctx.addIssue({ code: "custom", message: "errors.priceInvalid" });
      return z.NEVER;
    }
    return p;
  });

export const categoryInputSchema = z.object({ name: bilingualName });
export const itemInputSchema = z.object({ categoryId: z.guid(), name: bilingualName, price: priceInput });

export const languagesSchema = z.object({
  enabled: z.array(z.enum(["fr", "ar"])).min(1, "onboarding.languages.atLeastOne"),
  defaultLocale: z.enum(["fr", "ar"]),
  translations: z
    .array(z.object({ kind: z.enum(["category", "item"]), id: z.guid(), locale: z.enum(["fr", "ar"]), value: z.string().trim().max(80) }))
    .max(500)
    .default([]),
});

export const tablesSchema = z.object({ count: z.coerce.number<string | number>().int().min(0).max(100) });
