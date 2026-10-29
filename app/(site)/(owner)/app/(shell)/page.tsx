import { ChevronRight, PhoneCall } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinkRow } from "@/components/owner/link-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRestaurant, requireSession } from "@/lib/auth/session";
import { menuLinks } from "@/lib/links";

/** Onboarding steps shown in the checklist (4 = AI review is part of the menu step). */
const CHECKLIST = [1, 2, 3, 5, 6, 7] as const;

export default async function OwnerHome() {
  const { profile } = await requireSession();
  const restaurant = await requireRestaurant();
  const t = await getTranslations("home");
  const tl = await getTranslations("onboarding.live");
  const steps = (await getTranslations("onboarding")).raw("steps") as string[];
  const links = menuLinks(restaurant.slug);
  const done = CHECKLIST.filter((s) => s < restaurant.onboarding_step).length;
  const resume = CHECKLIST.find((s) => s >= restaurant.onboarding_step) ?? 7;
  const firstName = profile.full_name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{firstName ? t("hello", { name: firstName }) : t("helloNoName")}</h1>

      {done < CHECKLIST.length && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("setupTitle")}</CardTitle>
              <p className="text-sm text-muted">{t("setupProgress", { done, total: CHECKLIST.length })}</p>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${(done / CHECKLIST.length) * 100}%` }} />
            </div>
            <ol className="flex flex-col">
              {CHECKLIST.map((s) => (
                <li key={s}>
                  <Link
                    href={`/app/onboarding/${s}`}
                    className="flex min-h-11 items-center justify-between gap-2 border-b border-line text-sm last:border-0"
                  >
                    <span className={s < restaurant.onboarding_step ? "text-muted line-through" : "font-medium"}>{steps[s - 1]}</span>
                    <ChevronRight className="size-4 text-muted rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
            <Button asChild block>
              <Link href={`/app/onboarding/${resume}`}>{t("resume")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!profile.phone_verified_at && (
        <Link href="/app/compte/verification" className="rounded-lg">
          <Card className="flex items-center gap-3 p-4 hover:bg-sand">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
              <PhoneCall className="size-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{t("verifyTitle")}</span>
              <span className="block text-sm text-muted">{t("verifyBody")}</span>
            </span>
            <ChevronRight className="size-5 text-muted rtl:rotate-180" aria-hidden />
          </Card>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("linksTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LinkRow title={t("orderLink")} url={links.orderUrl} label={links.orderLabel} copyLabel={tl("copy")} copiedLabel={tl("copied")} openLabel={tl("open")} />
          <LinkRow title={t("tableLink")} url={links.tableUrl} label={links.tableLabel} copyLabel={tl("copy")} copiedLabel={tl("copied")} openLabel={tl("open")} />
        </CardContent>
      </Card>
    </div>
  );
}
