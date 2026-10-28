"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "../../actions";

export function AcceptInviteButton({ token, label }: { token: string; label: string }) {
  const tr = useTranslations();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <Button
        size="lg"
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvite(token);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        {label}
      </Button>
    </div>
  );
}
