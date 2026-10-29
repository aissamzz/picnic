import type { I18nText, ItemTag, MenuCategory, MenuCombo, MenuItem, PublicMenu } from "@/lib/menu/types";
import { TEMPLATE_KEYS, type TemplateKey } from "./meta";

/**
 * Demo menus for /template-1 … /template-9 and the template previews
 * (onboarding, appearance). Photos are bundled in public/templates/photos
 * (free licences, see public/templates/CREDITS.md). Nothing here touches the database.
 */

const photo = (name: string) => `/templates/photos/${name}.webp`;

type Dish = {
  fr: string;
  ar: string;
  price: number;
  photo?: string;
  tags?: ItemTag[];
  desc?: [string, string];
  sizes?: [string, string, number][];
};

let seq = 0;
/** Stable ids (same order on every render), valid UUID shape. */
const uid = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;

function item(key: string, d: Dish): MenuItem {
  return {
    id: uid(),
    name: { fr: d.fr, ar: d.ar },
    description: d.desc ? { fr: d.desc[0], ar: d.desc[1] } : {},
    base_price: d.sizes ? null : d.price,
    photos: d.photo ? [photo(d.photo)] : [],
    tags: d.tags ?? [],
    is_sold_out: false,
    variants: (d.sizes ?? []).map(([fr, ar, price]) => ({ id: uid(), name: { fr, ar }, price })),
    extras: [],
  };
}

function category(key: string, name: [string, string], dishes: Dish[]): MenuCategory {
  return { id: uid(), name: { fr: name[0], ar: name[1] }, icon: null, schedule_id: null, items: dishes.map((d) => item(key, d)) };
}

function combo(key: string, name: [string, string], price: number, photoName: string, includes: [string, string][], desc?: [string, string]): MenuCombo {
  return {
    id: uid(),
    name: { fr: name[0], ar: name[1] },
    description: desc ? { fr: desc[0], ar: desc[1] } : {},
    price,
    photo: photo(photoName),
    is_sold_out: false,
    includes: includes.map(([fr, ar]): I18nText => ({ fr, ar })),
  };
}

type Demo = { name: string; commune: string; wilaya: number; type: string; categories: MenuCategory[]; combos: MenuCombo[] };

const DEMOS: Record<TemplateKey, () => Demo> = {
  pizzeria: () => ({
    name: "Pizzeria Roma",
    commune: "Jijel",
    wilaya: 18,
    type: "pizzeria",
    categories: [
      category("pizz", ["Pizzas", "بيتزا"], [
        { fr: "Margherita", ar: "مارغريتا", price: 800, photo: "pizza-margherita", tags: ["best_seller"], desc: ["Tomate, mozzarella, basilic frais.", "طماطم، موزاريلا، ريحان طازج."], sizes: [["Moyenne", "متوسطة", 800], ["Large", "كبيرة", 1100]] },
        { fr: "Végétarienne", ar: "نباتية", price: 900, photo: "pizza-veggie", tags: ["vegetarian"], desc: ["Poivrons, champignons, olives, oignons.", "فلفل، فطر، زيتون، بصل."] },
        { fr: "Poulet BBQ", ar: "دجاج باربكيو", price: 1000, photo: "pizza-slices", tags: ["new"], desc: ["Poulet mariné, sauce barbecue, mozzarella.", "دجاج متبل، صلصة باربكيو، موزاريلا."] },
      ]),
      category("burg", ["Burgers et tacos", "برغر وتاكوس"], [
        { fr: "Burger Roma", ar: "برغر روما", price: 650, photo: "burger", tags: ["best_seller"], desc: ["Double steak, cheddar, sauce maison.", "شريحتان، شيدر، صلصة البيت."] },
        { fr: "Tacos poulet", ar: "تاكوس دجاج", price: 550, photo: "tacos", tags: ["spicy"], desc: ["Poulet épicé, frites, sauce fromagère.", "دجاج حار، بطاطا مقلية، صلصة الجبن."] },
        { fr: "Wrap poulet", ar: "راب دجاج", price: 450, photo: "wrap" },
        { fr: "Frites", ar: "بطاطا مقلية", price: 200, photo: "fries" },
      ]),
      category("boi", ["Boissons", "مشروبات"], [{ fr: "Jus d'orange pressé", ar: "عصير برتقال طازج", price: 250, photo: "orange-juice" }]),
    ],
    combos: [
      combo("comb", ["Menu Burger", "وجبة برغر"], 950, "burger", [["Burger Roma", "برغر روما"], ["Frites", "بطاطا مقلية"], ["Jus d'orange", "عصير برتقال"]]),
      combo("comb", ["Menu Duo Pizza", "وجبة بيتزا لشخصين"], 1900, "pizza-slices", [["2 pizzas moyennes", "بيتزا متوسطة ×2"], ["Frites", "بطاطا مقلية"]]),
    ],
  }),
  cafe: () => ({
    name: "Café El Bahia",
    commune: "Béjaïa",
    wilaya: 6,
    type: "cafe",
    categories: [
      category("caf", ["Cafés", "قهوة"], [
        { fr: "Cappuccino", ar: "كابوتشينو", price: 250, photo: "cappuccino", tags: ["best_seller"] },
        { fr: "Café latte", ar: "قهوة بالحليب", price: 280, photo: "latte" },
        { fr: "Café glacé", ar: "قهوة مثلجة", price: 350, photo: "iced-coffee", tags: ["new"] },
      ]),
      category("pdj", ["Petit-déjeuner", "فطور الصباح"], [
        { fr: "Croissant beurre", ar: "كرواسون بالزبدة", price: 120, photo: "croissants", tags: ["best_seller"] },
        { fr: "Pancakes au miel", ar: "بان كيك بالعسل", price: 450, photo: "pancakes", desc: ["Trois pancakes, miel, fruits de saison.", "ثلاث قطع، عسل، فواكه الموسم."] },
        { fr: "Toast œuf avocat", ar: "توست بالبيض والأفوكادو", price: 500, photo: "egg-toast" },
        { fr: "Petit-déjeuner complet", ar: "فطور كامل", price: 750, photo: "breakfast" },
      ]),
    ],
    combos: [combo("comb", ["Formule matin", "عرض الصباح"], 600, "pancakes", [["Pancakes", "بان كيك"], ["Cappuccino", "كابوتشينو"], ["Jus d'orange", "عصير برتقال"]])],
  }),
  traditionnel: () => ({
    name: "Dar El Djeddi",
    commune: "Tizi Ouzou",
    wilaya: 15,
    type: "traditional",
    categories: [
      category("ent", ["Entrées", "مقبلات"], [
        { fr: "Chorba frik", ar: "شوربة فريك", price: 300, photo: "soup", tags: ["best_seller"], desc: ["Soupe au blé vert concassé et à la viande.", "شوربة بالفريك واللحم."] },
        { fr: "Salade de saison", ar: "سلطة الموسم", price: 250, photo: "salad-bowl", tags: ["vegetarian"] },
      ]),
      category("plat", ["Plats", "أطباق"], [
        { fr: "Couscous aux légumes", ar: "كسكس بالخضر", price: 900, photo: "couscous", tags: ["best_seller"], desc: ["Semoule roulée main, légumes du marché.", "كسكس مفتول باليد وخضر السوق."] },
        { fr: "Chtitha poulet", ar: "شطيطحة دجاج", price: 850, photo: "stew", tags: ["spicy"] },
        { fr: "Brochettes mixtes", ar: "بروشات مشكلة", price: 1100, photo: "skewers" },
      ]),
      category("des", ["Desserts et thé", "حلويات وشاي"], [
        { fr: "Makroud", ar: "مقروط", price: 150, photo: "makroud" },
        { fr: "Thé à la menthe", ar: "شاي بالنعناع", price: 100, photo: "tea" },
      ]),
    ],
    combos: [combo("comb", ["Menu du jour", "طبق اليوم"], 1200, "couscous", [["Chorba frik", "شوربة فريك"], ["Couscous aux légumes", "كسكس بالخضر"], ["Thé à la menthe", "شاي بالنعناع"]])],
  }),
  gastro: () => ({
    name: "Maison Lumière",
    commune: "Hydra",
    wilaya: 16,
    type: "gastronomic",
    categories: [
      category("ent", ["Entrées", "مقبلات"], [
        { fr: "Salade tiède au bœuf", ar: "سلطة دافئة باللحم", price: 1400, photo: "salad-meat", desc: ["Jeunes pousses, bœuf snacké, vinaigrette au miel.", "أوراق صغيرة، لحم مشوي، صلصة العسل."] },
        { fr: "Penne à la tomate", ar: "بيني بالطماطم", price: 1200, photo: "penne" },
      ]),
      category("plat", ["Plats", "أطباق رئيسية"], [
        { fr: "Saumon, légumes croquants", ar: "سلمون وخضر مقرمشة", price: 2900, photo: "salmon", tags: ["best_seller"] },
        { fr: "Filet de bœuf", ar: "فيليه لحم البقر", price: 3200, photo: "steak", tags: ["best_seller"], desc: ["Cuisson au choix, jus corsé.", "طهي حسب الاختيار، صلصة مركزة."] },
      ]),
      category("des", ["Desserts", "حلويات"], [
        { fr: "Tiramisu", ar: "تيراميسو", price: 900, photo: "tiramisu" },
        { fr: "Panna cotta fraise", ar: "بانا كوتا بالفراولة", price: 850, photo: "panna-cotta", tags: ["new"] },
      ]),
    ],
    combos: [combo("comb", ["Menu dégustation", "قائمة التذوق"], 4800, "salmon", [["Salade tiède au bœuf", "سلطة دافئة باللحم"], ["Saumon", "سلمون"], ["Panna cotta", "بانا كوتا"]])],
  }),
  patisserie: () => ({
    name: "Douceurs de Lalla",
    commune: "Blida",
    wilaya: 9,
    type: "patisserie",
    categories: [
      category("gat", ["Gâteaux", "كعك"], [
        { fr: "Gâteau au chocolat", ar: "كعكة الشوكولاتة", price: 450, photo: "chocolate-cake", tags: ["best_seller"], desc: ["La part. Entier sur commande.", "للقطعة. الكعكة كاملة حسب الطلب."] },
        { fr: "Tarte fruits rouges", ar: "تارت الفواكه الحمراء", price: 400, photo: "berry-pie" },
        { fr: "Brownie", ar: "براوني", price: 250, photo: "brownie" },
      ]),
      category("pet", ["Petites douceurs", "حلويات صغيرة"], [
        { fr: "Cupcakes vanille", ar: "كب كيك بالفانيليا", price: 200, photo: "cupcakes", tags: ["best_seller"] },
        { fr: "Donuts", ar: "دونات", price: 150, photo: "donuts", tags: ["new"] },
        { fr: "Cookies", ar: "كوكيز", price: 100, photo: "cookies" },
      ]),
      category("gla", ["Glaces", "مثلجات"], [
        { fr: "Cornet deux boules", ar: "مخروط بكرتين", price: 200, photo: "ice-cream" },
        { fr: "Coupe chocolat", ar: "كأس الشوكولاتة", price: 450, photo: "sundae" },
      ]),
    ],
    combos: [combo("comb", ["Boîte goûter", "علبة اللمجة"], 900, "cupcakes", [["4 cupcakes", "4 كب كيك"], ["4 cookies", "4 كوكيز"]])],
  }),
  grill: () => ({
    name: "Le Feu de Bois",
    commune: "Oran",
    wilaya: 31,
    type: "grill",
    categories: [
      category("gri", ["Grillades", "مشويات"], [
        { fr: "Brochettes d'agneau", ar: "بروشات لحم الخروف", price: 1200, photo: "skewers", tags: ["best_seller"] },
        { fr: "Steak frites", ar: "ستيك مع بطاطا", price: 1600, photo: "steak-frites", tags: ["best_seller"] },
        { fr: "Entrecôte", ar: "أنتركوت", price: 2200, photo: "steak", desc: ["300 g, sauce au poivre.", "300 غ، صلصة الفلفل."] },
        { fr: "Assiette poulet grillé", ar: "صحن دجاج مشوي", price: 950, photo: "chicken-strips", tags: ["spicy"] },
      ]),
      category("acc", ["Accompagnements", "مرافقات"], [
        { fr: "Salade verte", ar: "سلطة خضراء", price: 250, photo: "salad-dark" },
        { fr: "Frites maison", ar: "بطاطا مقلية منزلية", price: 200, photo: "fries-cone" },
      ]),
    ],
    combos: [combo("comb", ["Plateau grill pour 2", "صينية مشويات لشخصين"], 3200, "grill-platter", [["Brochettes", "بروشات"], ["Poulet grillé", "دجاج مشوي"], ["Frites", "بطاطا مقلية"], ["Salade", "سلطة"]])],
  }),
  jus: () => ({
    name: "Fresh Bar",
    commune: "Sétif",
    wilaya: 19,
    type: "juice_bar",
    categories: [
      category("jus", ["Jus frais", "عصائر طازجة"], [
        { fr: "Orange pressée", ar: "برتقال معصور", price: 250, photo: "orange-juice", tags: ["best_seller"] },
        { fr: "Mangue", ar: "مانجو", price: 350, photo: "mango-juice", sizes: [["33 cl", "33 سل", 350], ["50 cl", "50 سل", 450]] },
        { fr: "Jus détox", ar: "عصير ديتوكس", price: 400, photo: "green-juices", tags: ["new"] },
      ]),
      category("smo", ["Smoothies et milkshakes", "سموذي وميلك شيك"], [
        { fr: "Smoothie fruits rouges", ar: "سموذي الفواكه الحمراء", price: 450, photo: "berry-smoothie", tags: ["best_seller"] },
        { fr: "Milkshake banane", ar: "ميلك شيك بالموز", price: 400, photo: "milkshakes" },
        { fr: "Bowl fraîcheur", ar: "بول منعش", price: 650, photo: "poke-bowl", tags: ["vegetarian"] },
      ]),
    ],
    combos: [combo("comb", ["Duo vitaminé", "ثنائي الفيتامينات"], 650, "berry-smoothie", [["Orange pressée", "برتقال معصور"], ["Smoothie fruits rouges", "سموذي الفواكه الحمراء"]])],
  }),
  mer: () => ({
    name: "La Sardine d'Or",
    commune: "Tipaza",
    wilaya: 42,
    type: "seafood",
    categories: [
      category("ent", ["Entrées", "مقبلات"], [
        { fr: "Crevettes à l'ail", ar: "قمبري بالثوم", price: 1500, photo: "shrimp", tags: ["best_seller"] },
        { fr: "Salade de la mer", ar: "سلطة البحر", price: 900, photo: "poke-bowl" },
      ]),
      category("poi", ["Poissons", "أسماك"], [
        { fr: "Pavé de saumon", ar: "قطعة سلمون", price: 2400, photo: "salmon", tags: ["best_seller"] },
        { fr: "Poisson du jour", ar: "سمك اليوم", price: 1800, photo: "fish-market", desc: ["Selon l'arrivage, grillé ou en sauce. Prix au kilo affiché au comptoir.", "حسب الصيد، مشوي أو بالصلصة."] },
        { fr: "Pâtes aux fruits de mer", ar: "معكرونة بفواكه البحر", price: 1600, photo: "penne", tags: ["new"] },
      ]),
    ],
    combos: [combo("comb", ["Plateau de la mer", "صينية البحر"], 4200, "fish-market", [["Crevettes", "قمبري"], ["Poisson du jour", "سمك اليوم"], ["Salade de la mer", "سلطة البحر"]], ["Pour deux personnes.", "لشخصين."])],
  }),
  coffee: () => ({
    name: "Grain Coffee",
    commune: "Constantine",
    wilaya: 25,
    type: "coffee_shop",
    categories: [
      category("caf", ["Espresso", "إسبريسو"], [
        { fr: "Latte", ar: "لاتيه", price: 300, photo: "latte", tags: ["best_seller"], sizes: [["Small", "صغير", 300], ["Large", "كبير", 380]] },
        { fr: "Flat white", ar: "فلات وايت", price: 320, photo: "lattes" },
        { fr: "Iced latte", ar: "لاتيه مثلج", price: 380, photo: "iced-coffee", tags: ["best_seller"] },
        { fr: "Thé & cookies", ar: "شاي وكوكيز", price: 300, photo: "tea-cookies" },
      ]),
      category("bak", ["Bakery", "مخبوزات"], [
        { fr: "Croissant", ar: "كرواسون", price: 150, photo: "croissants" },
        { fr: "Cookie chocolat", ar: "كوكي بالشوكولاتة", price: 120, photo: "cookies" },
        { fr: "Donut", ar: "دونات", price: 150, photo: "donuts", tags: ["new"] },
      ]),
    ],
    combos: [combo("comb", ["Coffee + cookie", "قهوة + كوكي"], 380, "lattes", [["Latte", "لاتيه"], ["Cookie chocolat", "كوكي بالشوكولاتة"]])],
  }),
};

/** Template number in /template-N (1-based, TEMPLATE_KEYS order). */
export function templateForNumber(n: number): TemplateKey | null {
  return TEMPLATE_KEYS[n - 1] ?? null;
}
export function numberForTemplate(key: TemplateKey): number {
  return TEMPLATE_KEYS.indexOf(key) + 1;
}

/** Demo payload shaped like get_public_menu(). `name` overrides the restaurant name (onboarding preview). */
export function demoMenu(key: TemplateKey, opts: { name?: string } = {}): PublicMenu {
  seq = 0;
  const d = DEMOS[key]();
  return {
    restaurant: {
      id: `00000000-0000-4000-8000-${String(numberForTemplate(key)).padStart(12, "0")}`,
      slug: `template-${numberForTemplate(key)}`,
      name: opts.name?.trim().slice(0, 80) || d.name,
      type: d.type,
      wilaya_code: d.wilaya,
      commune: d.commune,
      address: null,
      logo_path: null,
      cover_path: photo(`banner-${key}`),
      template_key: key,
      primary_color: null,
      default_locale: "fr",
      enabled_locales: ["fr", "ar"],
      timezone: "Africa/Algiers",
      status: "active",
      is_paused: false,
      show_powered_by: true,
      ordering_available: false,
      whatsapp_order_phone: null,
      delivery_enabled: false,
      takeaway_enabled: false,
      min_order: 0,
      eta_label: null,
      updated_at: "2026-11-01T00:00:00Z",
    },
    social: { instagram: null, facebook: null, tiktok: null, maps_url: null, google_review_url: null },
    hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "08:00:00", closes: "23:30:00" })),
    exceptions: [],
    schedules: [],
    delivery_zones: [],
    tables: [{ id: "00000000-0000-4000-9000-999999999999", code: "T1", label: "Table 1" }],
    categories: d.categories,
    combos: d.combos,
  };
}
