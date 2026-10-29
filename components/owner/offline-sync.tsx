"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { savePrices, setSoldOut } from "@/app/(site)/(owner)/app/(shell)/menu/actions";
import { countOps, isNetworkError, isOffline, pendingOps, QUEUE_EVENT, replaceQueue, setQueueScope, type QueuedOp } from "@/lib/offline/queue";

/** Replays the offline queue on reconnect and shows how many changes wait. */
export function OfflineSync({ restaurantId }: { restaurantId: string }) {
  const t = useTranslations("pwa.queue");
  const router = useRouter();
  const [pending, setPending] = React.useState(0);
  const busy = React.useRef(false);

  const flush = React.useCallback(async () => {
    if (busy.current || isOffline()) return;
    const ops = pendingOps();
    if (ops.length === 0) return;
    busy.current = true;
    let sent = 0;
    let failed = false;
    const left: QueuedOp[] = [];
    for (const [i, op] of ops.entries()) {
      try {
        const r = op.kind === "soldOut" ? await setSoldOut(op.itemId, op.value) : await savePrices(op.rows);
        if (r.ok) sent += op.kind === "prices" ? op.rows.length : 1;
        else failed = true;
      } catch (e) {
        if (!isNetworkError(e)) failed = true;
        else {
          left.push(...ops.slice(i));
          break;
        }
      }
    }
    replaceQueue(left);
    busy.current = false;
    if (sent) toast(t("synced", { count: sent }));
    if (failed) toast.error(t("failed"));
    if (sent || failed) router.refresh();
  }, [router, t]);

  React.useEffect(() => {
    setQueueScope(restaurantId);
    const update = () => setPending(countOps(pendingOps()));
    update();
    void flush();
    const online = () => void flush();
    window.addEventListener(QUEUE_EVENT, update);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener(QUEUE_EVENT, update);
      window.removeEventListener("online", online);
    };
  }, [restaurantId, flush]);

  if (!pending) return null;
  return (
    <p role="status" className="bg-warning-soft px-4 py-2 text-center text-sm font-medium text-warning">
      {t("pending", { count: pending })}
    </p>
  );
}
