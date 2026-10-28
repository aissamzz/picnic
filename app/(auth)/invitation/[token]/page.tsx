import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteButton } from "./accept-button";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("auth.invite");
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invite", { p_token: token });
  const invite = data?.[0];

  if (!invite || invite.status !== "pending") {
    return <ErrorState title={t("title")} description={t("invalid")} />;
  }

  const session = await getSession();
  const next = `/invitation/${encodeURIComponent(token)}`;
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("body", { restaurant: invite.restaurant_name, app: APP_NAME })}</p>
      {session ? (
        <AcceptInviteButton token={token} label={t("accept")} />
      ) : (
        <>
          <p className="text-sm text-muted">{t("needAccount")}</p>
          <div className="flex flex-col gap-2">
            <Button asChild size="lg" block>
              <Link href={`/inscription?next=${encodeURIComponent(next)}`}>{(await getTranslations("auth.signup"))("title")}</Link>
            </Button>
            <Button asChild size="lg" block variant="secondary">
              <Link href={`/connexion?next=${encodeURIComponent(next)}`}>{(await getTranslations("auth.login"))("title")}</Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
