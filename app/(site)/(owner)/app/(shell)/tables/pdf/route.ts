import { getTranslations } from "next-intl/server";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { menuLinks } from "@/lib/links";
import { tableCardsPdf } from "@/lib/pdf/table-cards";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** A4 sheets of table cards (QR + table name), 6 per page. */
export async function GET() {
  const r = await requireOwnerRestaurant();
  const supabase = await createClient();
  const { data: tables } = await supabase.from("tables").select("code, label").eq("restaurant_id", r.id).eq("is_active", true).order("position");
  const { tableUrl } = menuLinks(r.slug);
  const fr = await getTranslations({ locale: "fr", namespace: "owner.tables" });
  const ar = await getTranslations({ locale: "ar", namespace: "owner.tables" });
  const lines = r.enabled_locales.map((l) => (l === "ar" ? ar("scanToSee") : fr("scanToSee")));
  const pdf = await tableCardsPdf({
    restaurant: r.name,
    cards: (tables ?? []).map((t) => ({ label: t.label, url: `${tableUrl}?t=${encodeURIComponent(t.code)}` })),
    lines,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r.slug}-tables.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
