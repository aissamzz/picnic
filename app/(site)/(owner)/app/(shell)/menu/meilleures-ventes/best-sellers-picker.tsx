"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import { tx, type I18nText } from "@/lib/menu/types";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils/cn";
import { setBestSeller } from "../actions";

type Category = { id: string; name: I18nText; items: { id: string; name: I18nText; photo: string | null; on: boolean }[] };

/** One tap per dish: starred dishes appear in the "Best sellers" row of the menu. */
export function BestSellersPicker({ categories, editable, locale }: { categories: Category[]; editable: boolean; locale: Locale }) {
  const t = useTranslations("menuAdmin.bestSellers");
  const tr = useTranslations();
  const [on, setOn] = React.useState(() => new Set(categories.flatMap((c) => c.items.filter((i) => i.on).map((i) => i.id))));

  async function toggle(id: string) {
    const next = !on.has(id);
    setOn((s) => {
      const n = new Set(s);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
    const r = await setBestSeller(id, next);
    if (!r.ok) {
      setOn((s) => {
        const n = new Set(s);
        if (next) n.delete(id);
        else n.add(id);
        return n;
      });
      toast(tr(r.error as never));
    }
  }

  if (categories.every((c) => c.items.length === 0)) return <EmptyState title={t("emptyTitle")} description={t("emptyBody")} />;
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm font-medium">
        {t("count", { count: on.size })}
      </p>
      {categories
        .filter((c) => c.items.length > 0)
        .map((c) => (
          <Card key={c.id} className="flex flex-col p-2">
            <h2 className="px-2 pt-1 pb-2 font-semibold">{tx(c.name, locale)}</h2>
            <ul className="divide-y divide-line">
              {c.items.map((i) => {
                const name = tx(i.name, locale);
                const active = on.has(i.id);
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={!editable}
                      onClick={() => toggle(i.id)}
                      className="flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-start hover:bg-sand disabled:opacity-60"
                    >
                      <span className="size-10 shrink-0 overflow-hidden rounded-md bg-sand">
                        {i.photo && (
                          // eslint-disable-next-line @next/next/no-img-element -- owner-side thumbnail
                          <img src={publicImageUrl(i.photo) ?? ""} alt="" className="size-full object-cover" />
                        )}
                      </span>
                      <span className="flex-1 font-medium">{name}</span>
                      <Star className={cn("size-6", active ? "fill-accent text-accent" : "text-muted")} aria-hidden />
                      <span className="sr-only">{active ? t("on") : t("off")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
    </div>
  );
}
