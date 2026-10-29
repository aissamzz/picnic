"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KanbanBoard, KanbanCard, KanbanColumn } from "@/components/ui/kanban";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import { formatPrice } from "@/lib/price";
import { advanceKit, uploadMockup } from "../actions";

const STAGES = ["ordered", "mockup", "approved", "printed", "shipped", "delivered", "paid"] as const;
type Stage = (typeof STAGES)[number];
export type KitCard = {
  id: string;
  stage: Stage;
  stands_count: number;
  posters_count: number;
  cod_amount: number;
  owner_feedback: string | null;
  mockup_path: string | null;
  tracking_number: string | null;
  commune: string | null;
  restaurant: { id: string; name: string };
};

export function KitBoard({ kits }: { kits: KitCard[] }) {
  const t = useTranslations("admin.kits");
  const ts = useTranslations("kit.stages");
  const tk = useTranslations("kit");
  const tr = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [items, setItems] = React.useState(kits);
  const [shipping, setShipping] = React.useState<string | null>(null);
  const [tracking, setTracking] = React.useState("");
  const [pending, start] = React.useTransition();
  React.useEffect(() => setItems(kits), [kits]);

  const move = (kitId: string, to: string, trackingNumber?: string) =>
    start(async () => {
      const r = await advanceKit(kitId, to, trackingNumber);
      if (!r.ok) return void toast(tr(r.error as never));
      setItems((s) => s.map((k) => (k.id === kitId ? { ...k, stage: to as Stage } : k)));
      toast(t("moved"));
      router.refresh();
    });

  return (
    <>
      <KanbanBoard
        onMove={(kitId, to) => {
          if (to === "shipped") return setShipping(kitId);
          move(kitId, to);
        }}
      >
        {STAGES.map((stage) => {
          const cards = items.filter((k) => k.stage === stage);
          return (
            <KanbanColumn key={stage} id={stage} title={ts(stage)} count={cards.length}>
              {cards.map((k) => (
                <KanbanCard key={k.id} id={k.id} column={stage} dragLabel={`${k.restaurant.name} → ${ts(stage)}`}>
                  <Link href={`/admin/restaurants/${k.restaurant.id}`} className="block font-semibold hover:underline">
                    {k.restaurant.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {k.stands_count} {tk("stands").toLowerCase()} · {k.posters_count} {tk("posters")} · {k.commune}
                  </p>
                  <p className="text-xs">{t("codAmount", { amount: formatPrice(k.cod_amount, locale) })}</p>
                  {k.tracking_number && <p className="text-xs text-muted">{tk("tracking", { number: k.tracking_number })}</p>}
                  {k.stage === "mockup" && !k.owner_feedback && <p className="mt-1 text-xs font-semibold text-info">{t("waitingOwner")}</p>}
                  {k.owner_feedback && k.stage === "mockup" && <p className="mt-1 text-xs text-warning">{t("changes", { feedback: k.owner_feedback })}</p>}
                  {(k.stage === "ordered" || (k.stage === "mockup" && k.owner_feedback)) && <MockupUpload kitId={k.id} label={k.mockup_path ? t("newMockup") : t("uploadMockup")} />}
                </KanbanCard>
              ))}
            </KanbanColumn>
          );
        })}
      </KanbanBoard>
      <Dialog
        open={!!shipping}
        onOpenChange={(o) => !o && setShipping(null)}
        title={t("moveTitle")}
        footer={
          <Button
            loading={pending}
            onClick={() => {
              const id = shipping!;
              setShipping(null);
              move(id, "shipped", tracking);
              setTracking("");
            }}
          >
            {t("move")}
          </Button>
        }
      >
        <label className="flex flex-col gap-1 text-sm">
          {t("tracking")}
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} dir="ltr" />
        </label>
      </Dialog>
    </>
  );
}

function MockupUpload({ kitId, label }: { kitId: string; label: string }) {
  const tr = useTranslations();
  const t = useTranslations("admin.kits");
  const router = useRouter();
  const ref = React.useRef<HTMLInputElement>(null);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button size="sm" variant="secondary" className="mt-2" loading={pending} onClick={() => ref.current?.click()}>
        <Upload aria-hidden />
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        hidden
        aria-label={label}
        accept="application/pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          start(async () => {
            const form = new FormData();
            form.set("kitId", kitId);
            form.set("file", file);
            const r = await uploadMockup(form);
            toast(r.ok ? t("moved") : tr(r.error as never));
            router.refresh();
          });
        }}
      />
    </>
  );
}
