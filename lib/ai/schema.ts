import { z } from "zod";

/** Text as printed on the menu, per script. Never translated by the extractor. */
const printed = z.object({
  fr: z.string().nullable().describe("Text in Latin script (French, Darija in Latin letters), exactly as printed. null if none."),
  ar: z.string().nullable().describe("Text in Arabic script, exactly as printed. null if none."),
});

/**
 * What the vision model returns. Prices are kept as printed ("1.100", "11 00",
 * "1100 DA") and parsed by our own code, so a misread separator never becomes
 * a wrong number silently.
 */
export const extractionSchema = z.object({
  problem: z
    .enum(["none", "blurry", "not_menu", "partial"])
    .describe("none = readable menu; blurry = too blurry/dark to read; not_menu = not a menu; partial = some parts unreadable"),
  categories: z.array(
    z.object({
      name: printed,
      items: z.array(
        z.object({
          name: printed,
          description: printed.nullable(),
          price_text: z.string().nullable().describe("Single price exactly as printed, null when the dish has sizes or no price"),
          variants: z
            .array(z.object({ name: printed, price_text: z.string().nullable() }))
            .describe("Sizes or formats with their own price (Moyenne / Large, 1/2, 33 cl...). Empty when there is one price."),
          confidence: z
            .object({
              name: z.number().describe("0 to 1: how sure the name was read correctly"),
              price: z.number().describe("0 to 1: how sure the price(s) were read correctly"),
            })
            .describe("Lower it for handwriting, blur, glare, or guessed characters"),
        }),
      ),
    }),
  ),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const translationSchema = z.object({
  translations: z.array(z.object({ id: z.string(), text: z.string() })),
});
