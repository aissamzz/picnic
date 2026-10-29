import { getFormatter, getTranslations } from "next-intl/server";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { receiptPdf } from "@/lib/pdf/receipt";
import { formatPrice } from "@/lib/price";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** PDF receipt of an approved payment. Always in French, like other Algerian business documents. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireOwnerRestaurant();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const { data: p } = await (await createClient())
    .from("payments")
    .select("id, plan, method, amount, reference, period_start, period_end, reviewed_at, status")
    .eq("id", id)
    .eq("restaurant_id", r.id)
    .eq("status", "approved")
    .maybeSingle();
  if (!p) return new Response("Not found", { status: 404 });

  const t = await getTranslations({ locale: "fr", namespace: "receiptPdf" });
  const tb = await getTranslations({ locale: "fr", namespace: "billing" });
  const f = await getFormatter({ locale: "fr" });
  const date = (iso: string | null) => (iso ? f.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Algiers" }) : "");
  const number = `${p.reference}-${p.id.slice(0, 6).toUpperCase()}`;
  const pdf = await receiptPdf({
    labels: {
      title: t("title"),
      number: t("number"),
      restaurant: t("restaurant"),
      reference: t("reference"),
      plan: t("plan"),
      method: t("method"),
      period: t("period"),
      amount: t("amount"),
      paid: t("paid"),
      issuedOn: t("issuedOn", { date: date(p.reviewed_at) }),
      footer: t("footer"),
    },
    number,
    restaurant: r.name,
    reference: p.reference,
    plan: tb(`planMonths.${p.plan}`),
    method: tb(`methods.${p.method}`),
    period: tb("period", { from: date(p.period_start), to: date(p.period_end) }),
    amount: formatPrice(p.amount, "fr"),
  });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="recu-${number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
