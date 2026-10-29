import { Gift, MessageCircle } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { requireOwnerRestaurant } from "@/lib/auth/session";
import { APP_URL } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export default async function ReferralPage() {
  const r = await requireOwnerRestaurant();
  const t = await getTranslations("referral");
  const tb = await getTranslations("billing");
  const f = await getFormatter();
  const supabase = await createClient();
  const [{ data: billing }, { data: referrals }] = await Promise.all([
    supabase.from("restaurant_billing").select("referral_code").eq("id", r.id).single(),
    supabase.rpc("my_referrals", { p_restaurant_id: r.id }),
  ]);
  const code = billing?.referral_code ?? "";
  const link = `${APP_URL}/inscription?ref=${code}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t("shareText")} ${link}`)}`;
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/plus" label={(await getTranslations("more"))("title")} />
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">{t("code")}</p>
            <p className="text-2xl font-bold tracking-widest" dir="ltr">
              {code}
            </p>
          </div>
          <Gift className="size-8 text-clay" aria-hidden />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-md bg-sand px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("link")}</p>
            <p className="truncate text-sm font-semibold" dir="ltr">
              {link.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <CopyButton value={link} label={tb("copy")} copiedLabel={tb("copied")} variant="secondary" size="sm" />
        </div>
        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1F7A3D] px-4 font-semibold text-white">
          <MessageCircle className="size-5" aria-hidden />
          {t("whatsapp")}
        </a>
      </Card>
      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{t("how")}</h2>
        <ol className="list-decimal ps-5 text-sm text-muted">
          {(t.raw("steps") as string[]).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t("list")}</h2>
        {!referrals?.length ? (
          <p className="text-sm text-muted">{t("empty")}</p>
        ) : (
          <Card className="divide-y divide-line">
            {referrals.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{x.name}</p>
                  <p className="text-sm text-muted">{f.dateTime(new Date(x.created_at), { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                <Badge tone={x.rewarded ? "success" : "neutral"}>{x.rewarded ? t("rewarded") : t("waiting")}</Badge>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
