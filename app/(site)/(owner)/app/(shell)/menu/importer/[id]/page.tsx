import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { requireRestaurant } from "@/lib/auth/session";
import type { ImportDraft } from "@/lib/ai/draft";
import { createClient } from "@/lib/supabase/server";
import { MenuReview } from "./menu-review";

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const restaurant = await requireRestaurant();
  const t = await getTranslations("import");
  const { data } = await (await createClient())
    .from("ai_imports")
    .select("id, result")
    .eq("id", id)
    .eq("restaurant_id", restaurant.id)
    .eq("status", "done")
    .is("applied_at", null)
    .maybeSingle();
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu/importer" label={t("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("review.title")}</h1>
        <p className="text-muted">{t("review.subtitle")}</p>
      </div>
      {data ? <MenuReview importId={data.id} draft={data.result as unknown as ImportDraft} /> : <p className="text-muted">{t("review.notFound")}</p>}
    </div>
  );
}
