"use client";

import { ChevronRight, Eye, EyeOff, Pencil, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { SortableList } from "@/components/owner/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import type { Locale } from "@/lib/i18n/config";
import type { AdminCategory } from "@/lib/menu/admin-data";
import { tx } from "@/lib/menu/types";
import { cn } from "@/lib/utils/cn";
import { reorderCategories, setCategoryVisible } from "./actions";
import { CategorySheet } from "./category-sheet";

export function CategoriesBoard({ categories, editable, locale }: { categories: AdminCategory[]; editable: boolean; locale: Locale }) {
  const t = useTranslations("menuAdmin");
  const tr = useTranslations();
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [visible, setVisible] = React.useState<Record<string, boolean>>({});
  const isVisible = (c: AdminCategory) => visible[c.id] ?? c.is_visible;

  const report = (r: { ok: boolean; error?: string }) => {
    if (!r.ok) toast(tr((r.error ?? "errors.generic") as never));
  };

  return (
    <section aria-labelledby="cats" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="cats" className="text-lg font-semibold">
          {t("categories")}
        </h2>
        {editable && (
          <Button variant="soft" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            {t("addCategory")}
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <SortableList
          items={categories}
          disabled={!editable}
          className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface"
          handleLabel={(c) => t("dragHandle", { name: tx(c.name, locale) })}
          onReorder={(ids) => reorderCategories(ids).then(report)}
          renderItem={(c, handle) => {
            const name = tx(c.name, locale);
            const shown = isVisible(c);
            return (
              <div className={cn("flex items-center gap-1 bg-surface pe-1", !handle && "ps-3")}>
                {handle}
                <Link href={`/app/menu/categories/${c.id}/items`} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center py-2">
                  <span className={cn("truncate font-semibold", !shown && "text-muted line-through")}>{name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {t("itemsCount", { count: c.itemsCount })}
                    {c.soldOutCount > 0 && <Badge tone="warning">{t("soldOutCount", { count: c.soldOutCount })}</Badge>}
                    {!shown && <Badge>{t("hidden")}</Badge>}
                  </span>
                </Link>
                {editable && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-pressed={shown}
                      aria-label={shown ? t("hide", { name }) : t("show", { name })}
                      onClick={() => {
                        setVisible((v) => ({ ...v, [c.id]: !shown }));
                        setCategoryVisible(c.id, !shown).then(report);
                      }}
                    >
                      {shown ? <Eye /> : <EyeOff className="text-muted" />}
                    </Button>
                    <Button asChild variant="ghost" size="icon" aria-label={t("edit", { name })}>
                      <Link href={`/app/menu/categories/${c.id}`}>
                        <Pencil />
                      </Link>
                    </Button>
                  </>
                )}
                <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden />
              </div>
            );
          }}
        />
      )}
      <CategorySheet
        open={adding}
        onOpenChange={setAdding}
        onSaved={(id) => {
          setAdding(false);
          router.push(`/app/menu/categories/${id}/items`);
        }}
      />
    </section>
  );
}
