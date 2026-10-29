import { Bell } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { requireRestaurant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OWNER_NOTIFICATIONS } from "@/lib/notifications";
import { cn } from "@/lib/utils/cn";
import { MarkRead } from "./mark-read";


export default async function NotificationsPage() {
  const r = await requireRestaurant();
  const t = await getTranslations("notifications");
  const f = await getFormatter();
  const { data: items } = await (await createClient())
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("restaurant_id", r.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const date = (iso: unknown) => (typeof iso === "string" ? f.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" }) : "");
  // Billing notices are for owners; staff only see the rest.
  const visible = (items ?? []).filter((n) => r.role === "owner" || OWNER_NOTIFICATIONS[n.kind] === undefined);
  const unread = visible.some((n) => !n.read_at);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {unread && <MarkRead label={t("markAll")} />}
      {!visible.length ? (
        <EmptyState icon={<Bell />} title={t("empty")} />
      ) : (
        <Card className="divide-y divide-line">
          {visible.map((n) => {
            const p = (n.payload ?? {}) as Record<string, string>;
            const text = t.has(`kinds.${n.kind}`)
              ? t(`kinds.${n.kind}` as never, { date: date(p.paid_until ?? p.ends_at), reason: p.reason ?? "", restaurant: p.restaurant ?? "" } as never)
              : n.kind;
            const href = OWNER_NOTIFICATIONS[n.kind];
            const body = (
              <>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="flex-1">
                  <span className={cn("block", !n.read_at && "font-semibold")}>{text}</span>
                  <span className="block text-sm text-muted">{f.relativeTime(new Date(n.created_at))}</span>
                </span>
              </>
            );
            return href ? (
              <Link key={n.id} href={href} className="flex gap-3 p-4 hover:bg-sand">
                {body}
              </Link>
            ) : (
              <div key={n.id} className="flex gap-3 p-4">
                {body}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
