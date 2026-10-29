"use client";

import { Keyboard, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { MenuImporter, Tips } from "@/components/owner/import/menu-importer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { EmptyState } from "@/components/ui/states";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";
import { addCategory, addItem, deleteCategory, deleteItem, skipStep } from "../actions";
import { StepHeader } from "./step-header";

type I18n = Record<string, string>;
type Category = { id: string; name: unknown; items: { id: string; name: unknown; base_price: number | null }[] };

/** Text in the UI language, falling back to the other one. */
function pick(v: unknown, locale: Locale): string {
  const o = (v ?? {}) as I18n;
  return o[locale] || o.fr || o.ar || "";
}

export function MenuStep({ categories, importsLeft }: { categories: Category[]; importsLeft: number | null }) {
  const t = useTranslations("onboarding.import");
  const to = useTranslations("onboarding");
  const locale = useLocale() as Locale;
  const [manual, setManual] = React.useState(categories.length > 0);
  const [continuing, start] = React.useTransition();

  return (
    <div className="flex flex-col gap-5">
      <StepHeader title={t("title")} subtitle={t("subtitle")} />

      <Card className="flex flex-col gap-3 p-4">
        <Tips />
      </Card>

      <MenuImporter reviewPrefix="/app/onboarding/4?import=" importsLeft={importsLeft} onManual={() => setManual(true)} />

      <button
        type="button"
        onClick={() => setManual(true)}
        aria-pressed={manual}
        className={cn(
          "flex min-h-14 items-center gap-3 rounded-lg border px-4 text-start font-semibold",
          manual ? "border-2 border-primary bg-primary-soft text-primary" : "border-line bg-surface hover:bg-sand",
        )}
      >
        <Keyboard className="size-5" aria-hidden />
        {t("manual")}
      </button>

      {manual && (
        <section aria-labelledby="cats-title" className="flex flex-col gap-3">
          <h2 id="cats-title" className="text-lg font-semibold">
            {t("categories")}
          </h2>
          {categories.length === 0 && <EmptyState icon={<UtensilsCrossed />} title={t("emptyTitle")} description={t("emptyBody")} />}
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} locale={locale} />
          ))}
          <AddCategoryForm />
        </section>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t border-line bg-sand/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {categories.length === 0 ? (
          <Button variant="secondary" size="lg" className="flex-1" loading={continuing} onClick={() => start(() => skipStep(3))}>
            {to("skip")}
          </Button>
        ) : (
          <Button size="lg" className="flex-1" loading={continuing} onClick={() => start(() => skipStep(3))}>
            {to("next")}
          </Button>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ category, locale }: { category: Category; locale: Locale }) {
  const t = useTranslations("onboarding.import");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const name = pick(category.name, locale);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="text-sm text-muted">{t("itemsCount", { count: category.items.length })}</p>
        </div>
        <Button
          variant="danger-ghost"
          size="icon"
          aria-label={t("delete", { name })}
          loading={pending}
          onClick={() =>
            start(async () => {
              await deleteCategory(category.id);
              router.refresh();
            })
          }
        >
          {!pending && <Trash2 />}
        </Button>
      </div>
      {category.items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {category.items.map((i) => (
            <ItemRow key={i.id} item={i} locale={locale} />
          ))}
        </ul>
      )}
      <AddItemForm categoryId={category.id} />
    </Card>
  );
}

function ItemRow({ item, locale }: { item: Category["items"][number]; locale: Locale }) {
  const t = useTranslations("onboarding.import");
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const name = pick(item.name, locale);
  return (
    <li className="flex items-center gap-2 ps-3">
      <span className="flex-1 truncate">{name}</span>
      {item.base_price != null && <Price amount={item.base_price} className="text-sm font-semibold" />}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("delete", { name })}
        loading={pending}
        onClick={() =>
          start(async () => {
            await deleteItem(item.id);
            router.refresh();
          })
        }
      >
        {!pending && <Trash2 className="text-muted" />}
      </Button>
    </li>
  );
}

function useBilingualForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = React.useState(initial);
  const set = (k: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  return { values, set, reset: () => setValues(initial) };
}

function AddCategoryForm() {
  const t = useTranslations("onboarding.import");
  const tr = useTranslations();
  const router = useRouter();
  const { values, set, reset } = useBilingualForm({ fr: "", ar: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-lg border border-dashed border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await addCategory({ name: values });
          if (!r.ok) return setError(r.fieldErrors?.["name.fr"] ?? r.error);
          reset();
          router.refresh();
        });
      }}
    >
      <p className="font-semibold">{t("addCategory")}</p>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cat-fr" label={t("categoryName")}>
          <Input id="cat-fr" lang="fr" dir="ltr" value={values.fr} onChange={set("fr")} placeholder={t("examples")} />
        </Field>
        <Field id="cat-ar" label={t("categoryNameAr")}>
          <Input id="cat-ar" lang="ar" dir="rtl" value={values.ar} onChange={set("ar")} />
        </Field>
      </div>
      <Button type="submit" variant="soft" loading={pending} className="self-start">
        <Plus aria-hidden />
        {t("addCategory")}
      </Button>
    </form>
  );
}

function AddItemForm({ categoryId }: { categoryId: string }) {
  const t = useTranslations("onboarding.import");
  const tr = useTranslations();
  const router = useRouter();
  const { values, set, reset } = useBilingualForm({ fr: "", ar: "", price: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const id = (k: string) => `item-${categoryId}-${k}`;
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const r = await addItem({ categoryId, name: { fr: values.fr, ar: values.ar }, price: values.price });
          if (!r.ok) return setError(r.fieldErrors?.["name.fr"] ?? r.fieldErrors?.price ?? r.error);
          reset();
          router.refresh();
        });
      }}
    >
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
        <Field id={id("fr")} label={t("itemName")}>
          <Input id={id("fr")} lang="fr" dir="ltr" value={values.fr} onChange={set("fr")} />
        </Field>
        <Field id={id("ar")} label={t("itemNameAr")}>
          <Input id={id("ar")} lang="ar" dir="rtl" value={values.ar} onChange={set("ar")} />
        </Field>
        <Field id={id("price")} label={t("itemPrice")}>
          <Input id={id("price")} inputMode="numeric" dir="ltr" value={values.price} onChange={set("price")} className="tabular" />
        </Field>
      </div>
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        <Plus aria-hidden />
        {t("addItem")}
      </Button>
    </form>
  );
}
