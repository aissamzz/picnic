"use client";

import { MessageCircle, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "@/components/ui/toast";
import { formatDzPhone, toWaNumber } from "@/lib/utils/phone";
import { inviteStaff, removeMember } from "./actions";

type Member = { id: string; role: "owner" | "staff"; status: "pending" | "accepted" | "revoked"; name: string | null; phone: string | null; token: string | null };

function ShareInvite({ url, phone, restaurantName }: { url: string; phone: string | null; restaurantName: string }) {
  const t = useTranslations("owner.team");
  const text = t("shareText", { restaurant: restaurantName, url });
  const wa = `https://wa.me/${phone ? toWaNumber(phone) : ""}?text=${encodeURIComponent(text)}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="soft" size="sm">
        <a href={wa} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden />
          {t("sendWhatsapp")}
        </a>
      </Button>
      <CopyButton value={url} label={t("copyLink")} copiedLabel={t("copied")} size="sm" />
    </div>
  );
}

export function TeamManager({ members, editable, restaurantName, inviteBase }: { members: Member[]; editable: boolean; restaurantName: string; inviteBase: string }) {
  const t = useTranslations("owner.team");
  const tr = useTranslations();
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const [created, setCreated] = React.useState<{ url: string; phone: string } | null>(null);

  const staff = members.filter((m) => m.role === "staff" && m.status === "accepted");
  const invites = members.filter((m) => m.status === "pending");
  const owners = members.filter((m) => m.role === "owner");

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await inviteStaff(phone);
      if (!r.ok) return setError(r.error);
      setCreated({ url: inviteBase + r.data.token, phone });
      setPhone("");
    });
  }

  const label = (m: Member) => m.name || (m.phone ? formatDzPhone(m.phone) : "—");

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{t("inviteTitle")}</h2>
        <p className="text-sm text-muted">{t("inviteHint")}</p>
        <form onSubmit={invite} noValidate className="flex flex-col gap-3">
          <FormAlert>{error && tr(error as never)}</FormAlert>
          <Field id="invite-phone" label={t("phone")}>
            <PhoneInput id="invite-phone" value={phone} onChange={setPhone} disabled={!editable} />
          </Field>
          <Button type="submit" className="self-start" loading={pending} disabled={!editable || !phone.trim()}>
            <UserPlus aria-hidden />
            {t("invite")}
          </Button>
        </form>
        {created && (
          <div role="status" className="flex flex-col gap-2 rounded-md bg-primary-soft p-3">
            <p className="text-sm font-medium">{t("created")}</p>
            <p dir="ltr" className="break-all text-sm text-muted">
              {created.url}
            </p>
            <ShareInvite url={created.url} phone={null} restaurantName={restaurantName} />
          </div>
        )}
      </Card>

      <Card className="flex flex-col p-4">
        <h2 className="font-semibold">{t("membersTitle")}</h2>
        <ul className="divide-y divide-line">
          {[...owners, ...staff].map((m) => (
            <li key={m.id} className="flex min-h-14 items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{label(m)}</span>
                {m.name && m.phone && (
                  <span dir="ltr" className="self-start text-sm text-muted">
                    {formatDzPhone(m.phone)}
                  </span>
                )}
              </div>
              <Badge>{m.role === "owner" ? t("owner") : t("staff")}</Badge>
              {m.role === "staff" && (
                <Button variant="ghost" size="icon" aria-label={t("remove", { name: label(m) })} disabled={!editable} onClick={() => setRemoving(m)}>
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {staff.length === 0 && <p className="text-sm text-muted">{t("noStaff")}</p>}
        <p className="mt-2 text-sm text-muted">{t("staffCan")}</p>
      </Card>

      {invites.length > 0 && (
        <Card className="flex flex-col p-4">
          <h2 className="font-semibold">{t("pendingTitle")}</h2>
          <ul className="divide-y divide-line">
            {invites.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center gap-3">
                  <span dir="ltr" className="flex-1 font-medium">
                    {m.phone ? formatDzPhone(m.phone) : "—"}
                  </span>
                  <Button variant="ghost" size="sm" disabled={!editable} onClick={() => setRemoving(m)}>
                    {t("cancelInvite")}
                  </Button>
                </div>
                {m.token && <ShareInvite url={inviteBase + m.token} phone={m.phone} restaurantName={restaurantName} />}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.status === "pending" ? t("cancelInvite") : t("removeTitle")}
        description={removing ? (removing.status === "pending" ? t("cancelBody") : t("removeBody", { name: label(removing) })) : undefined}
        footer={
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await removeMember(removing!.id);
                setRemoving(null);
                toast(r.ok ? t("removed") : tr(r.error as never));
              })
            }
          >
            {t("confirm")}
          </Button>
        }
      />
    </div>
  );
}
