"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { reviewMockup } from "../abonnement/actions";

export function MockupReview({ kitId, url }: { kitId: string; url: string }) {
  const t = useTranslations("kit");
  const tr = useTranslations();
  const router = useRouter();
  const [changes, setChanges] = React.useState(false);
  const [feedback, setFeedback] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const send = (approve: boolean) =>
    start(async () => {
      setError(null);
      const r = await reviewMockup(kitId, approve, feedback);
      if (!r.ok) return setError(r.error);
      if (!approve) toast(t("feedbackSent"));
      router.refresh();
    });
  return (
    <Card className="flex flex-col gap-3 border-primary/40 p-4">
      <div>
        <h2 className="font-semibold">{t("mockupTitle")}</h2>
        <p className="text-sm text-muted">{t("mockupBody")}</p>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-primary">
        <ExternalLink className="size-4" aria-hidden />
        {t("openMockup")}
      </a>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      {changes ? (
        <>
          <Field id="feedback" label={t("feedback")}>
            <Textarea id="feedback" rows={3} maxLength={500} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          <Button loading={pending} disabled={!feedback.trim()} onClick={() => send(false)}>
            {t("sendFeedback")}
          </Button>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button className="flex-1" loading={pending} onClick={() => send(true)}>
            {t("approve")}
          </Button>
          <Button variant="secondary" onClick={() => setChanges(true)}>
            {t("requestChanges")}
          </Button>
        </div>
      )}
    </Card>
  );
}
