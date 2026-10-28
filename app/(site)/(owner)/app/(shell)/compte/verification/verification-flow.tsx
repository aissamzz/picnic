"use client";

import { BadgeCheck, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { CodeRequestPanel } from "@/components/forms/code-request-panel";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CodeInput } from "@/components/ui/code-input";
import { Field } from "@/components/ui/field";
import { Ltr } from "@/components/ui/ltr";
import { formatDzPhone } from "@/lib/utils/phone";
import { getVerificationStatus, requestVerification, verifyPhone } from "../actions";

export function VerificationFlow({ phone, verified, initialRequestId }: { phone: string; verified: boolean; initialRequestId: string | null }) {
  const t = useTranslations("account.verification");
  const tr = useTranslations();
  const router = useRouter();
  const [requestId, setRequestId] = React.useState(initialRequestId);
  const [done, setDone] = React.useState(verified);
  const [requesting, startRequest] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function request() {
    startRequest(async () => {
      setError(null);
      const r = await requestVerification();
      if (r.ok) setRequestId(r.data.requestId);
      else setError(r.error);
    });
  }

  if (done) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center" role="status">
        <BadgeCheck className="size-12 text-success" aria-hidden />
        <p className="text-lg font-semibold">{t("success")}</p>
        <Button asChild variant="secondary">
          <Link href="/app">{tr("nav.home")}</Link>
        </Button>
      </Card>
    );
  }

  if (!requestId) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <FormAlert>{error && tr(error as never)}</FormAlert>
        <p>{t.rich("intro", { phone: () => <Ltr className="font-semibold">{formatDzPhone(phone)}</Ltr> })}</p>
        <Button size="lg" block onClick={request} loading={requesting}>
          <PhoneCall aria-hidden />
          {t("request")}
        </Button>
      </Card>
    );
  }

  return (
    <CodeRequestPanel
      key={requestId}
      phone={phone}
      poll={() => getVerificationStatus(requestId)}
      onRequestAgain={request}
      requestAgainPending={requesting}
    >
      <CodeForm
        onVerified={() => {
          setDone(true);
          router.refresh();
        }}
      />
    </CodeRequestPanel>
  );
}

function CodeForm({ onVerified }: { onVerified: () => void }) {
  const tc = useTranslations("code");
  const tr = useTranslations();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await verifyPhone({ code });
          if (r.ok) onVerified();
          else setError(r.error);
        });
      }}
    >
      <Field id="code" label={tc("code")} error={error && tr(error as never)}>
        <CodeInput id="code" value={code} onChange={setCode} aria-invalid={!!error} aria-describedby={error ? "code-error" : undefined} autoFocus />
      </Field>
      <Button type="submit" size="lg" block loading={pending} disabled={code.length !== 6}>
        {tc("verify")}
      </Button>
    </form>
  );
}
