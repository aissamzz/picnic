"use client";

import { ImagePlus, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useFieldArray, useForm, type UseFormRegister } from "react-hook-form";
import type { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/server-errors";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { cropToBlob, ImageCropper, type Area } from "@/components/ui/image-cropper";
import { Input, Select, Textarea } from "@/components/ui/input";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import type { I18nText, ItemTag } from "@/lib/menu/types";
import { publicImageUrl } from "@/lib/storage";
import { ITEM_TAGS, type itemSchema } from "@/lib/validation/menu";
import { deleteItem, restoreItem, saveItem, uploadItemPhoto } from "../../actions";

type Values = z.input<typeof itemSchema>;
type Item = {
  id: string;
  categoryId: string;
  name: I18nText;
  description: I18nText;
  basePrice: number | null;
  photos: string[];
  tags: ItemTag[];
  isSoldOut: boolean;
  isVisible: boolean;
  variants: { name: I18nText; price: number }[];
  extras: { name: I18nText; price: number }[];
};

const text = (v?: I18nText) => ({ fr: v?.fr ?? "", ar: v?.ar ?? "" });

export function ItemEditor({
  item,
  defaultCategoryId,
  categories,
  editable,
}: {
  item: Item | null;
  defaultCategoryId: string;
  categories: { id: string; name: string }[];
  editable: boolean;
}) {
  const t = useTranslations("menuAdmin.item");
  const ta = useTranslations("menuAdmin");
  const tm = useTranslations("menu");
  const tr = useTranslations();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<Values>({
    defaultValues: {
      id: item?.id,
      categoryId: item?.categoryId ?? defaultCategoryId,
      name: text(item?.name),
      description: text(item?.description),
      basePrice: item?.basePrice != null ? String(item.basePrice) : "",
      tags: item?.tags ?? [],
      isSoldOut: item?.isSoldOut ?? false,
      isVisible: item?.isVisible ?? true,
      photos: item?.photos ?? [],
      variants: (item?.variants ?? []).map((v) => ({ name: text(v.name), price: String(v.price) })),
      extras: (item?.extras ?? []).map((x) => ({ name: text(x.name), price: String(x.price) })),
    },
  });
  const variants = useFieldArray({ control: form.control, name: "variants" });
  const extras = useFieldArray({ control: form.control, name: "extras" });
  const { errors } = form.formState;
  const tags = (form.watch("tags") ?? []) as ItemTag[];
  const photos = (form.watch("photos") ?? []) as string[];
  const err = (path: string) => {
    const e = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;
    return e?.message ? tr(e.message as never) : undefined;
  };

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setFormError(null);
      const r = await saveItem(values);
      if (!r.ok) return setFormError(applyServerErrors(r, form.setError) ?? (r.fieldErrors ? "errors.generic" : null));
      toast(ta("saved"));
      router.push(`/app/menu/categories/${values.categoryId}/items`);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <fieldset disabled={!editable} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 p-4">
          <legend className="sr-only">{t("name")}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="name-fr" label={`${t("name")} · ${t("nameFr")}`} error={err("name.fr")}>
              <Input id="name-fr" lang="fr" dir="ltr" {...form.register("name.fr")} />
            </Field>
            <Field id="name-ar" label={`${t("name")} · ${t("nameAr")}`}>
              <Input id="name-ar" lang="ar" dir="rtl" {...form.register("name.ar")} />
            </Field>
            <Field id="desc-fr" label={`${t("description")} · ${t("nameFr")}`}>
              <Textarea id="desc-fr" lang="fr" dir="ltr" rows={2} {...form.register("description.fr")} />
            </Field>
            <Field id="desc-ar" label={`${t("description")} · ${t("nameAr")}`}>
              <Textarea id="desc-ar" lang="ar" dir="rtl" rows={2} {...form.register("description.ar")} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="category" label={t("category")}>
              <Select id="category" {...form.register("categoryId")}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="price" label={t("price")} hint={t("priceHint")} error={err("basePrice")}>
              <Input id="price" inputMode="numeric" dir="ltr" className="tabular" aria-describedby="price-hint" {...form.register("basePrice")} />
            </Field>
          </div>
        </Card>

        <OptionList
          title={t("variants")}
          hint={t("variantsHint")}
          addLabel={t("addVariant")}
          fields={variants.fields}
          onAdd={() => variants.append({ name: { fr: "", ar: "" }, price: "" })}
          onRemove={variants.remove}
          prefix="variants"
          register={form.register}
          err={err}
        />
        <OptionList
          title={t("extras")}
          hint={t("extrasHint")}
          addLabel={t("addExtra")}
          fields={extras.fields}
          onAdd={() => extras.append({ name: { fr: "", ar: "" }, price: "" })}
          onRemove={extras.remove}
          prefix="extras"
          register={form.register}
          err={err}
        />

        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">{t("badges")}</h2>
          <div className="flex flex-wrap gap-2">
            {ITEM_TAGS.map((tag) => (
              <Chip
                key={tag}
                selected={tags.includes(tag)}
                onClick={() => form.setValue("tags", tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag])}
              >
                {tm(`tags.${tag}`)}
              </Chip>
            ))}
          </div>
        </Card>

        <Photos
          photos={photos}
          onChange={(p) => form.setValue("photos", p, { shouldDirty: true })}
          onError={(e) => setFormError(e)}
        />

        <Card className="flex flex-col divide-y divide-line px-4">
          <h2 className="sr-only">{t("status")}</h2>
          <label className="flex min-h-14 items-center justify-between gap-3">
            <span className="font-medium">{t("soldOut")}</span>
            <Toggle checked={!!form.watch("isSoldOut")} onCheckedChange={(v) => form.setValue("isSoldOut", v)} />
          </label>
          <label className="flex min-h-14 items-center justify-between gap-3">
            <span className="font-medium">{ta("visibleOnMenu")}</span>
            <Toggle checked={form.watch("isVisible") !== false} onCheckedChange={(v) => form.setValue("isVisible", v)} />
          </label>
        </Card>
      </fieldset>

      {editable && (
        <div className="sticky bottom-16 z-20 -mx-4 flex gap-2 border-t border-line bg-sand/95 px-4 py-3 backdrop-blur">
          {item && (
            <Button
              type="button"
              variant="danger-ghost"
              size="icon"
              aria-label={ta("deleteItem")}
              onClick={() =>
                start(async () => {
                  const r = await deleteItem(item.id);
                  if (!r.ok) return setFormError(r.error);
                  toastWithUndo(ta("itemDeleted", { name: item.name.fr || item.name.ar || "" }), {
                    undoLabel: tr("ui.undo"),
                    onUndo: () => restoreItem(item.id).then(() => router.refresh()),
                  });
                  router.push(`/app/menu/categories/${item.categoryId}/items`);
                })
              }
            >
              <Trash2 />
            </Button>
          )}
          <Button type="submit" size="lg" className="flex-1" loading={pending}>
            {t("save")}
          </Button>
        </div>
      )}
    </form>
  );
}

function OptionList({
  title,
  hint,
  addLabel,
  fields,
  onAdd,
  onRemove,
  prefix,
  register,
  err,
}: {
  title: string;
  hint: string;
  addLabel: string;
  fields: { id: string }[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  prefix: "variants" | "extras";
  register: UseFormRegister<Values>;
  err: (path: string) => string | undefined;
}) {
  const t = useTranslations("menuAdmin.item");
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {fields.map((f, i) => {
        const e = err(`${prefix}.${i}.name.fr`) ?? err(`${prefix}.${i}.price`);
        return (
          <div key={f.id} className="flex flex-col gap-1">
            {/* Names side by side, then price + remove: fits 390px. */}
            <div className="grid grid-cols-2 gap-2 rounded-md border border-line p-2 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end sm:border-0 sm:p-0">
              <Field id={`${prefix}-${i}-fr`} label={t("optionName")}>
                <Input id={`${prefix}-${i}-fr`} lang="fr" dir="ltr" {...register(`${prefix}.${i}.name.fr`)} />
              </Field>
              <Field id={`${prefix}-${i}-ar`} label={t("optionNameAr")}>
                <Input id={`${prefix}-${i}-ar`} lang="ar" dir="rtl" {...register(`${prefix}.${i}.name.ar`)} />
              </Field>
              <Field id={`${prefix}-${i}-price`} label={t("optionPrice")}>
                <Input id={`${prefix}-${i}-price`} inputMode="numeric" dir="ltr" className="tabular" {...register(`${prefix}.${i}.price`)} />
              </Field>
              <Button type="button" variant="ghost" size="icon" className="self-end justify-self-end" aria-label={`${t("remove")} ${i + 1}`} onClick={() => onRemove(i)}>
                <X />
              </Button>
            </div>
            {e && (
              <p role="alert" className="text-sm text-danger">
                {e}
              </p>
            )}
          </div>
        );
      })}
      <Button type="button" variant="secondary" className="self-start" onClick={onAdd}>
        <Plus aria-hidden />
        {addLabel}
      </Button>
    </Card>
  );
}

function Photos({ photos, onChange, onError }: { photos: string[]; onChange: (p: string[]) => void; onError: (e: string) => void }) {
  const t = useTranslations("menuAdmin.item");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<Area | null>(null);
  const [uploading, setUploading] = React.useState(false);

  async function applyCrop() {
    if (!src || !crop) return;
    setUploading(true);
    setSrc(null);
    try {
      const blob = await cropToBlob(src, crop, "image/webp", 0.9);
      const fd = new FormData();
      fd.append("photo", new File([blob], "photo.webp", { type: "image/webp" }));
      const r = await uploadItemPhoto(fd);
      if (r.ok) onChange([...photos, r.data.path]);
      else onError(r.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">{t("photos")}</h2>
        <p className="text-sm text-muted">{t("photosHint")}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <li key={p} className="relative aspect-[4/3] overflow-hidden rounded-md bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-side preview */}
            <img src={publicImageUrl(p) ?? ""} alt="" className="size-full object-cover" />
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              {i === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
                  <Star className="size-3" aria-hidden />
                  {t("makeMain")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange([p, ...photos.filter((x) => x !== p)])}
                  className="inline-flex min-h-9 items-center rounded-full bg-white/90 px-2 text-xs font-semibold"
                >
                  {t("makeMain")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x !== p))}
                aria-label={`${t("removePhoto")} ${i + 1}`}
                className="inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {photos.length < 4 && (
          <li>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-sm font-medium text-muted hover:bg-sand"
            >
              {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
              {uploading ? t("uploading") : t("addPhoto")}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => setSrc(String(reader.result));
          reader.readAsDataURL(f);
        }}
      />
      <BottomSheet
        open={!!src}
        onOpenChange={(o) => !o && setSrc(null)}
        title={t("cropTitle")}
        footer={
          <Button type="button" block size="lg" onClick={applyCrop}>
            {t("cropSave")}
          </Button>
        }
      >
        {src && <ImageCropper src={src} aspect={4 / 3} onCropComplete={setCrop} />}
      </BottomSheet>
    </Card>
  );
}
