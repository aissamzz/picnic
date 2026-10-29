"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/(site)/(auth)/actions";

type State = { mode: "loading" } | { mode: "verify"; factorId: string } | { mode: "enroll"; factorId: string; qr: string; secret: string };

export function MfaForm() {
  const t = useTranslations("admin.mfa");
  const router = useRouter();
  const [state, setState] = React.useState<State>({ mode: "loading" });
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  const started = React.useRef(false);
  React.useEffect(() => {
    // Once: enrolling twice (Strict Mode) would leave a stray factor.
    if (started.current) return;
    started.current = true;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp.find((f) => f.status === "verified");
      if (verified) return setState({ mode: "verify", factorId: verified.id });
      // Leftovers from an enrollment that was never confirmed.
      for (const f of data?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: e, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Liinky admin ${new Date().toISOString().slice(0, 10)}` });
      if (err || !e) return setError(t("invalid"));
      setState({ mode: "enroll", factorId: e.id, qr: e.totp.qr_code, secret: e.totp.secret });
    })();
  }, [t]);

  if (state.mode === "loading") return <Skeleton className="h-64 w-full" />;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: state.factorId, code: code.trim() });
          if (err) return setError(t("invalid"));
          router.replace("/admin");
          router.refresh();
        });
      }}
    >
      {state.mode === "enroll" ? (
        <Card className="flex flex-col items-center gap-3 p-4 text-center">
          <p className="font-semibold">{t("enrollTitle")}</p>
          <p className="text-sm text-muted">{t("enrollBody")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from the auth server */}
          <img src={state.qr} alt="QR" className="size-48" />
          <p className="text-xs text-muted">{t("secret")}</p>
          <code className="rounded bg-sand px-2 py-1 font-mono text-sm break-all" dir="ltr" data-testid="totp-secret">
            {state.secret}
          </code>
        </Card>
      ) : (
        <div>
          <p className="font-semibold">{t("verifyTitle")}</p>
          <p className="text-sm text-muted">{t("verifyBody")}</p>
        </div>
      )}
      <FormAlert>{error}</FormAlert>
      <Field id="totp" label={t("code")}>
        <Input
          id="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          dir="ltr"
          className="text-center text-2xl tracking-[0.5em] tabular"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </Field>
      <Button type="submit" size="lg" disabled={code.length !== 6} loading={pending}>
        {t("verify")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => void signOut()}>
        {t("signOut")}
      </Button>
    </form>
  );
}
