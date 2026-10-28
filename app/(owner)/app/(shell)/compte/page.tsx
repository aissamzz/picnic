import { BadgeCheck, ChevronRight, PhoneCall } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ltr } from "@/components/ui/ltr";
import { requireSession } from "@/lib/auth/session";
import { formatDzPhone } from "@/lib/utils/phone";
import { NameForm, PasswordForm } from "./forms";

export default async function AccountPage() {
  const { profile } = await requireSession();
  const t = await getTranslations("account");
  const verified = !!profile.phone_verified_at;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <NameForm defaultName={profile.full_name ?? ""} />
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <p className="text-sm font-medium">{t("phone")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Ltr className="text-lg font-semibold tabular">{profile.phone ? formatDzPhone(profile.phone) : "—"}</Ltr>
              {verified ? (
                <Badge tone="success">
                  <BadgeCheck aria-hidden />
                  {t("verified")}
                </Badge>
              ) : (
                <Badge tone="warning">{t("notVerified")}</Badge>
              )}
            </div>
            {!verified && (
              <>
                <p className="text-sm text-muted">{t("verifyHint")}</p>
                <Link
                  href="/app/compte/verification"
                  className="flex min-h-12 items-center gap-3 rounded-md bg-primary px-4 font-semibold text-white hover:bg-primary-hover"
                >
                  <PhoneCall className="size-5" aria-hidden />
                  <span className="flex-1">{t("verifyCta")}</span>
                  <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
                </Link>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("passwordTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
