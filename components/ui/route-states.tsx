"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { ErrorState } from "./states";

/** error.tsx body for the owner and admin areas. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  React.useEffect(() => console.error(error), [error]);
  return (
    <ErrorState
      className="mt-6"
      title={t("errors.generic")}
      description={error.digest ? `Réf. ${error.digest}` : undefined}
      action={
        <Button variant="secondary" onClick={reset}>
          <RotateCw aria-hidden />
          {t("ui.retry")}
        </Button>
      }
    />
  );
}

/** loading.tsx body: a title and a few card rows. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  const t = useTranslations("ui");
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
