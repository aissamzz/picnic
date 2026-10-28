"use client";

import { BadgeCheck, KeyRound, Phone, RefreshCw, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { EmptyState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { formatMMSS, useCountdown } from "@/hooks/use-countdown";
import { formatDzPhone } from "@/lib/utils/phone";
import { cancelCode, createCode, issueCode, listCodeRequests, type CodeRequestRow, type IssuedCode } from "./actions";

export function CodesBoard({ initial }: { initial: CodeRequestRow[] }) {
  const t = useTranslations("admin.codes");
  const [rows, setRows] = React.useState(initial);
  // Codes are only known right after generation; keep them in memory while they live.
  const [codes, setCodes] = React.useState<Record<string, IssuedCode>>({});

  React.useEffect(() => {
    const id = window.setInterval(async () => setRows(await listCodeRequests()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const onIssued = (c: IssuedCode) => {
    setCodes((prev) => ({ ...prev, [c.requestId]: c }));
    listCodeRequests().then(setRows);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="pending-title" className="font-semibold">
            {t("status.requested")} · <span className="tabular">{rows.length}</span>
          </h2>
          <span className="flex items-center gap-1 text-xs text-muted">
            <RefreshCw className="size-3.5" aria-hidden />
            {t("autoRefresh")}
          </span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<KeyRound />} title={t("empty")} />
        ) : (
          rows.map((r) => (
            <RequestCard
              key={r.id}
              row={r}
              issued={codes[r.id]}
              onIssued={onIssued}
              onCancelled={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
            />
          ))
        )}
      </section>
      <ManualCode onIssued={onIssued} issued={Object.values(codes).find((c) => !rows.some((r) => r.id === c.requestId))} />
    </div>
  );
}

function RequestCard({
  row,
  issued,
  onIssued,
  onCancelled,
}: {
  row: CodeRequestRow;
  issued?: IssuedCode;
  onIssued: (c: IssuedCode) => void;
  onCancelled: () => void;
}) {
  const t = useTranslations("admin.codes");
  const format = useFormatter();
  const [pending, start] = React.useTransition();
  const active = row.status === "issued" && issued;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.purpose === "reset_password" ? "warning" : "info"}>{t(`purpose.${row.purpose}`)}</Badge>
            <StatusPill tone={row.status === "issued" ? "success" : "neutral"} pulse={row.status === "requested"}>
              {t(`status.${row.status === "issued" ? "issued" : "requested"}`)}
            </StatusPill>
            {row.phone_verified && (
              <Badge tone="success">
                <BadgeCheck aria-hidden />
                {t("verified")}
              </Badge>
            )}
          </div>
          <p className="text-lg font-semibold">{row.full_name ?? "—"}</p>
          <p className="text-sm text-muted">{row.restaurants ?? t("noRestaurant")}</p>
          <p className="text-xs text-muted">
            {t("requestedAt", { time: format.dateTime(new Date(row.requested_at), { hour: "2-digit", minute: "2-digit" }) })}
            {row.requested_by_admin && ` · ${t("byAdmin")}`}
          </p>
        </div>
        <Button asChild variant="secondary" size="lg">
          <a href={`tel:${row.phone}`}>
            <Phone aria-hidden />
            <bdi dir="ltr" className="tabular">
              {formatDzPhone(row.phone)}
            </bdi>
          </a>
        </Button>
      </div>
      {active && <CodeDisplay key={issued.code} code={issued.code} secondsLeft={issued.secondsLeft} />}
      <div className="flex flex-wrap gap-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const r = await issueCode(row.id);
              if (r.ok) onIssued(r.data);
            })
          }
        >
          <KeyRound aria-hidden />
          {row.status === "issued" ? t("regenerate") : t("generate")}
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            start(async () => {
              const r = await cancelCode(row.id);
              if (r.ok) onCancelled();
            })
          }
        >
          <X aria-hidden />
          {t("cancel")}
        </Button>
      </div>
    </Card>
  );
}

function CodeDisplay({ code, secondsLeft }: { code: string; secondsLeft: number }) {
  const t = useTranslations("admin.codes");
  const left = useCountdown(secondsLeft);
  const expired = left === 0;
  return (
    <div className={`flex items-center justify-between gap-4 rounded-md px-4 py-3 ${expired ? "bg-line/60" : "bg-primary-soft"}`}>
      <div>
        <p className="text-xs font-medium text-muted">{t("codeLabel")}</p>
        <p
          data-testid="issued-code"
          className={`text-4xl font-bold tracking-[0.25em] tabular ${expired ? "text-muted line-through" : "text-ink"}`}
          dir="ltr"
        >
          {code.slice(0, 3)} {code.slice(3)}
        </p>
      </div>
      <div className="text-end" aria-live="polite">
        <p className="text-xs text-muted">{expired ? t("status.expired") : t("expiresIn")}</p>
        <p className={`text-2xl font-bold tabular ${left <= 30 ? "text-warning" : "text-primary"}`} dir="ltr">
          {formatMMSS(left)}
        </p>
      </div>
    </div>
  );
}

function ManualCode({ onIssued, issued }: { onIssued: (c: IssuedCode) => void; issued?: IssuedCode }) {
  const t = useTranslations("admin.codes");
  const tr = useTranslations();
  const [phone, setPhone] = React.useState("");
  const [purpose, setPurpose] = React.useState<"verify_phone" | "reset_password">("verify_phone");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-semibold">{t("manualTitle")}</h2>
        <p className="text-sm text-muted">{t("manualHint")}</p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await createCode({ phone, purpose });
            if (r.ok) onIssued(r.data);
            else setError(r.error);
          });
        }}
      >
        <FormAlert>{error && tr(error as never)}</FormAlert>
        <Field id="manual-phone" label={t("manualPhone")}>
          <PhoneInput id="manual-phone" value={phone} onChange={setPhone} />
        </Field>
        <Field id="manual-purpose" label={t("manualPurpose")}>
          <Select id="manual-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}>
            <option value="verify_phone">{t("purpose.verify_phone")}</option>
            <option value="reset_password">{t("purpose.reset_password")}</option>
          </Select>
        </Field>
        <Button type="submit" loading={pending}>
          <KeyRound aria-hidden />
          {t("manualSubmit")}
        </Button>
      </form>
      {issued && <CodeDisplay key={issued.requestId + issued.code} code={issued.code} secondsLeft={issued.secondsLeft} />}
    </Card>
  );
}
