import { Check, Circle, Package } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { Card } from "@/components/ui/card";
import { requireOwnerRestaurant, requireSession } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { KitOrderForm } from "./kit-order-form";
import { MockupReview } from "./mockup-review";

const STAGES = ["ordered", "mockup", "approved", "printed", "shipped", "delivered", "paid"] as const;

export default async function KitPage() {
  const r = await requireOwnerRestaurant();
  const { profile } = await requireSession();
  const t = await getTranslations("kit");
  const f = await getFormatter();
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const [{ data: kit }, { data: details }, { data: info }, { count: tables }] = await Promise.all([
    supabase.from("kit_orders").select("*").eq("restaurant_id", r.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("payment_details").maybeSingle(),
    supabase.from("restaurants").select("wilaya_code, commune, address, whatsapp_order_phone").eq("id", r.id).single(),
    supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", r.id).eq("is_active", true),
  ]);
  const open = kit && kit.stage !== "paid";
  let mockupUrl: string | null = null;
  if (kit?.mockup_path && kit.stage === "mockup") {
    // The kit row was read through RLS (owner only); sign its mockup server-side.
    const { data } = await createServiceClient().storage.from("kit").createSignedUrl(kit.mockup_path, 600);
    mockupUrl = data?.signedUrl ?? null;
  }
  const reached = kit ? STAGES.indexOf(kit.stage) : -1;
  const when = (stage: string) => {
    const steps = ((kit?.timeline ?? []) as { stage: string; at: string }[]).filter((s) => s.stage === stage);
    const last = steps.at(-1);
    return last ? f.dateTime(new Date(last.at), { day: "numeric", month: "short" }) : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/abonnement" label={(await getTranslations("billing"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>

      {kit && (
        <Card className="flex flex-col gap-4 p-4">
          <h2 className="font-semibold">{t("timeline")}</h2>
          <ol className="flex flex-col gap-3">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-3" aria-current={i === reached ? "step" : undefined}>
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", i <= reached ? "bg-primary text-white" : "border-2 border-line text-muted")}>
                  {i <= reached ? <Check className="size-4" aria-hidden /> : <Circle className="size-2" aria-hidden />}
                </span>
                <span className={cn("flex-1", i === reached ? "font-semibold" : i > reached && "text-muted")}>{t(`stages.${s}`)}</span>
                {i <= reached && <span className="text-sm text-muted tabular">{when(s)}</span>}
              </li>
            ))}
          </ol>
          {kit.tracking_number && <p className="text-sm">{t("tracking", { number: kit.tracking_number })}</p>}
          {kit.stage === "approved" && <p className="text-sm text-muted">{t("approved")}</p>}
          {kit.stage === "paid" && <p className="text-sm font-semibold text-success">{t("done")}</p>}
        </Card>
      )}

      {kit?.stage === "mockup" && kit.owner_feedback && (
        <Card className="p-4 text-sm" role="status">
          {t("waitingNewMockup", { feedback: kit.owner_feedback })}
        </Card>
      )}
      {kit?.stage === "mockup" && !kit.owner_feedback && mockupUrl && <MockupReview kitId={kit.id} url={mockupUrl} />}

      {!open && (
        <>
          <Card className="flex gap-3 p-4">
            <Package className="size-6 shrink-0 text-clay" aria-hidden />
            <div>
              <p className="font-semibold">{t("includes")}</p>
              <ul className="list-disc ps-4 text-sm text-muted">
                {(t.raw("includesList") as string[]).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </Card>
          <KitOrderForm
            locale={locale}
            kitPrice={details?.kit_price ?? 6000}
            annualPrice={details?.price_annual ?? 24000}
            initial={{
              stands: Math.min(50, Math.max(1, tables ?? 4)),
              posters: 2,
              wilayaCode: info?.wilaya_code ?? null,
              commune: info?.commune ?? "",
              address: info?.address ?? "",
              phone: info?.whatsapp_order_phone ?? profile.phone ?? "",
            }}
          />
        </>
      )}
    </div>
  );
}
