import type { Extraction } from "./schema";
import { AiError, type MenuExtractor, type MenuSource, type MenuTranslator, type TranslationRequest } from "./types";

/**
 * Offline stand-ins for local dev and E2E (AI_PROVIDER=fixture).
 * The file name picks the scenario:
 *   *blurry*  -> unreadable photo
 *   *arabe*   -> Arabic-only handwritten menu
 *   anything  -> bilingual pizzeria menu with messy prices, a duplicate and low-confidence fields
 */
export class FixtureMenuExtractor implements MenuExtractor {
  async extract(sources: MenuSource[]): Promise<Extraction> {
    await new Promise((r) => setTimeout(r, 400));
    const names = sources.map((s) => s.name.toLowerCase()).join(" ");
    if (names.includes("blurry")) throw new AiError("unreadable");
    if (names.includes("arabe")) return ARABIC_ONLY;
    return sources.length > 1 ? { ...PIZZERIA, categories: [...PIZZERIA.categories, PIZZERIA_PAGE_2] } : PIZZERIA;
  }
}

const t = (fr: string | null, ar: string | null = null) => ({ fr, ar });
const sure = { name: 0.95, price: 0.95 };

const PIZZERIA: Extraction = {
  problem: "none",
  categories: [
    {
      name: t("Pizzas", "بيتزا"),
      items: [
        { name: t("Pizza Margherita", "بيتزا مارغريتا"), description: t("Tomate, mozzarella"), price_text: "800 DA", variants: [], confidence: sure },
        {
          name: t("Pizza 4 Fromages"),
          description: null,
          price_text: null,
          variants: [
            { name: t("Moyenne"), price_text: "1.100" },
            { name: t("Large"), price_text: "15 00" },
          ],
          confidence: { name: 0.9, price: 0.55 },
        },
        { name: t("Pizza Thon", "بيتزا تونة"), description: null, price_text: "1000", variants: [], confidence: sure },
      ],
    },
    {
      name: t("Boissons", "مشروبات"),
      items: [
        { name: t("Café", "قهوة"), description: null, price_text: "١٥٠ دج", variants: [], confidence: sure },
        { name: t("Jus d'orage"), description: null, price_text: "250", variants: [], confidence: { name: 0.5, price: 0.9 } },
        { name: t("Cafe"), description: null, price_text: "150", variants: [], confidence: sure },
      ],
    },
  ],
};

const PIZZERIA_PAGE_2 = {
  name: t("Desserts", "حلويات"),
  items: [{ name: t("Tiramisu"), description: null, price_text: "300 DA", variants: [], confidence: sure }],
};

const ARABIC_ONLY: Extraction = {
  problem: "partial",
  categories: [
    {
      name: t(null, "أكل خفيف"),
      items: [
        { name: t(null, "محاجب"), description: null, price_text: "60", variants: [], confidence: { name: 0.8, price: 0.6 } },
        { name: t(null, "كرانتيكا"), description: null, price_text: "50 دج", variants: [], confidence: sure },
        { name: t(null, "شوربة"), description: null, price_text: null, variants: [], confidence: { name: 0.9, price: 0.2 } },
      ],
    },
  ],
};

const DICTIONARY: Record<string, string> = {
  Pizzas: "بيتزا",
  "Pizza 4 Fromages": "بيتزا 4 أجبان",
  Moyenne: "متوسطة",
  Large: "كبيرة",
  Boissons: "مشروبات",
  "Jus d'orange": "عصير برتقال",
  Tiramisu: "تيراميسو",
  Desserts: "حلويات",
  "أكل خفيف": "Snacks",
  محاجب: "Mhadjeb",
  كرانتيكا: "Karantika",
  شوربة: "Chorba",
};

export class FixtureMenuTranslator implements MenuTranslator {
  async translate(entries: TranslationRequest[]): Promise<Map<string, string>> {
    await new Promise((r) => setTimeout(r, 200));
    return new Map(entries.map((e) => [e.id, DICTIONARY[e.text] ?? (e.to === "ar" ? `${e.text} (ع)` : `${e.text} (FR)`)]));
  }
}
