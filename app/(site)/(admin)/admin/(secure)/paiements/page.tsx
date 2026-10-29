import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { PaymentCard, type QueueItem } from "./payment-card";

export default async function PaymentsQueue() {
  const t = await getTranslations("admin.payments");
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, plan, method, amount, reference, receipt_path, created_at, restaurant:restaurants(id, name, slug)")
    .eq("status", "pending")
    .order("created_at");
  // Receipts are private: short-lived links signed for this page.
  const storage = createServiceClient().storage.from("receipts");
  const items: QueueItem[] = await Promise.all(
    (data ?? []).map(async (p) => ({
      ...p,
      restaurant: p.restaurant as unknown as QueueItem["restaurant"],
      receiptUrl: p.receipt_path ? ((await storage.createSignedUrl(p.receipt_path, 900)).data?.signedUrl ?? null) : null,
      isPdf: !!p.receipt_path?.endsWith(".pdf"),
    })),
  );
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      {items.length === 0 ? <Card className="p-6 text-center text-muted">{t("empty")}</Card> : items.map((p) => <PaymentCard key={p.id} p={p} />)}
    </div>
  );
}
