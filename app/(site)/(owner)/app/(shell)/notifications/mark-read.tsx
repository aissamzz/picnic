"use client";

import { CheckCheck } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "../abonnement/actions";

export function MarkRead({ label }: { label: string }) {
  const [pending, start] = React.useTransition();
  return (
    <Button variant="secondary" size="sm" className="self-start" loading={pending} onClick={() => start(() => markNotificationsRead())}>
      <CheckCheck aria-hidden />
      {label}
    </Button>
  );
}
