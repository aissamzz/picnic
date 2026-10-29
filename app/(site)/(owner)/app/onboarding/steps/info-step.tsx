"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/server-errors";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { cropToBlob, ImageCropper, type Area } from "@/components/ui/image-cropper";
import { Input, inputClass, Select } from "@/components/ui/input";
import { PhoneInput, toNationalNumber } from "@/components/ui/phone-input";
import { APP_DOMAIN } from "@/lib/config";
import { RESTAURANT_TYPES, type RestaurantType } from "@/lib/dz/restaurant-types";
import { WILAYAS } from "@/lib/dz/wilayas";
import type { Locale } from "@/lib/i18n/config";
import { slugify } from "@/lib/slug";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils/cn";
import { infoSchema } from "@/lib/validation/onboarding";
import { checkSlug, finishInfo, removeLogo, saveInfo, uploadLogo } from "../actions";
import { StepFooter } from "./step-footer";
import { StepHeader } from "./step-header";

type Values = z.input<typeof infoSchema>;
type Initial = {
  name: string;
  slug: string;
  type: RestaurantType;
  wilaya_code: number | null;
  commune: string | null;
  address: string | null;
  whatsapp_order_phone: string | null;
  logo_path: string | null;
} | null;

type SlugState = { state: "idle" | "checking" | "available" | "taken"; suggestion?: string | null };

/** Onboarding step 1, also reused as the restaurant info settings screen (`mode="settings"`). */
export function InfoStep({
  initial,
  accountPhone,
  locale,
  mode = "onboarding",
}: {
  initial: Initial;
  accountPhone: string | null;
  locale: Locale;
  mode?: "onboarding" | "settings";
}) {
  const t = useTranslations("onboarding.info");
  const ts = useTranslations("owner.infoSettings");
  const router = useRouter();
  const tt = useTranslations("restaurantTypes");
  const tr = useTranslations();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const slugTouched = React.useRef(!!initial);
  const [slugState, setSlugState] = React.useState<SlugState>({ state: initial ? "available" : "idle" });

  const form = useForm<Values, unknown, z.output<typeof infoSchema>>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: initial?.name ?? "",
      slug: initial?.slug ?? "",
      type: initial?.type ?? "restaurant",
      wilayaCode: initial?.wilaya_code ? String(initial.wilaya_code) : "",
      commune: initial?.commune ?? "",
      address: initial?.address ?? "",
      whatsapp: toNationalNumber(initial ? (initial.whatsapp_order_phone ?? "") : (accountPhone ?? "")),
    },
  });
  const { errors } = form.formState;
  const err = (k: keyof Values) => (errors[k]?.message ? tr(errors[k]!.message as never) : undefined);
  const [name, slug, commune] = useWatch({ control: form.control, name: ["name", "slug", "commune"] });

  // Follow the name until the owner edits the link by hand.
  React.useEffect(() => {
    if (!slugTouched.current) form.setValue("slug", slugify(name ?? ""), { shouldValidate: false });
  }, [name, form]);
  // An Arabic-only name leaves the slug empty: let the server suggest one.

  // Debounced availability check with a free alternative.
  React.useEffect(() => {
    if (initial && slug === initial.slug) return setSlugState({ state: "available" });
    if (!slug && !name) return setSlugState({ state: "idle" });
    setSlugState({ state: "checking" });
    const id = window.setTimeout(async () => {
      const r = await checkSlug({ slug: slug ?? "", name: name ?? "", commune: commune ?? "" });
      if (!r.available && r.suggestion && !slugTouched.current) {
        form.setValue("slug", r.suggestion);
        return;
      }
      setSlugState({ state: r.available ? "available" : "taken", suggestion: r.suggestion });
    }, 450);
    return () => window.clearTimeout(id);
  }, [slug, name, commune, initial, form]);

  // Logo: pick -> crop in a sheet -> keep the blob until submit.
  const [logoSrc, setLogoSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<Area | null>(null);
  const [logoBlob, setLogoBlob] = React.useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(publicImageUrl(initial?.logo_path));
  const [logoRemoved, setLogoRemoved] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // The server re-validates, so it receives the raw form input.
  const onSubmit = form.handleSubmit(() =>
    start(async () => {
      setFormError(null);
      const result = await saveInfo(form.getValues());
      if (!result.ok) {
        setFormError(applyServerErrors(result, form.setError));
        return;
      }
      if (logoBlob) {
        const fd = new FormData();
        fd.append("logo", new File([logoBlob], "logo.webp", { type: "image/webp" }));
        const up = await uploadLogo(fd);
        if (!up.ok) return setFormError(up.error);
      } else if (logoRemoved && initial?.logo_path) {
        await removeLogo();
      }
      if (mode === "settings") {
        toast(ts("saved"));
        router.refresh();
      } else await finishInfo();
    }),
  );

  return (
    <form id="info-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {mode === "settings" ? <StepHeader title={ts("title")} subtitle={ts("subtitle")} /> : <StepHeader title={t("title")} subtitle={t("subtitle")} />}
      <FormAlert>{formError && tr(formError as never)}</FormAlert>

      <Field id="name" label={t("name")} error={err("name")}>
        <Input id="name" aria-invalid={!!errors.name} aria-describedby={describedBy("name", { error: errors.name })} {...form.register("name")} />
      </Field>

      <Field id="slug" label={t("slug")} error={err("slug") ?? (slugState.state === "taken" ? tr("errors.slugUnavailable") : undefined)}>
        <div dir="ltr" className="flex items-stretch">
          <span className="flex min-h-11 items-center rounded-s-md border border-e-0 border-line bg-sand px-3 text-sm text-muted">{APP_DOMAIN}/</span>
          <input
            id="slug"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={cn(inputClass, "rounded-s-none")}
            aria-invalid={!!errors.slug || slugState.state === "taken"}
            aria-describedby="slug-status"
            {...form.register("slug", {
              onChange: (e) => {
                slugTouched.current = true;
                form.setValue("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
              },
            })}
          />
        </div>
        <p id="slug-status" className="flex min-h-5 items-center gap-1.5 text-sm" aria-live="polite">
          {slugState.state === "checking" && (
            <span className="flex items-center gap-1.5 text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("slugChecking")}
            </span>
          )}
          {slugState.state === "available" && slug && (
            <span className="flex items-center gap-1.5 text-success">
              <Check className="size-4" aria-hidden />
              {t("slugAvailable")}
            </span>
          )}
          {slugState.state === "taken" && slugState.suggestion && (
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-4"
              onClick={() => form.setValue("slug", slugState.suggestion!)}
            >
              <bdi dir="ltr">{slugState.suggestion}</bdi>
            </button>
          )}
        </p>
        {mode === "settings" && initial && slug !== initial.slug && (
          <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">
            {ts("slugWarning", { old: `${APP_DOMAIN}/${initial.slug}` })}
          </p>
        )}
      </Field>

      <Field id="type" label={t("type")} error={err("type")}>
        <Select id="type" {...form.register("type")}>
          {RESTAURANT_TYPES.map((k) => (
            <option key={k} value={k}>
              {tt(k)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="wilayaCode" label={t("wilaya")} error={err("wilayaCode")}>
          <Select
            id="wilayaCode"
            aria-invalid={!!errors.wilayaCode}
            aria-describedby={describedBy("wilayaCode", { error: errors.wilayaCode })}
            {...form.register("wilayaCode")}
          >
            <option value="">{t("wilayaPlaceholder")}</option>
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {String(w.code).padStart(2, "0")} · {w[locale]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="commune" label={t("commune")} error={err("commune")}>
          <Input id="commune" autoComplete="address-level2" {...form.register("commune")} />
        </Field>
      </div>

      <Field id="address" label={t("address")} hint={t("addressHint")}>
        <Input id="address" autoComplete="street-address" aria-describedby="address-hint" {...form.register("address")} />
      </Field>

      <Field id="whatsapp" label={t("whatsapp")} hint={t("whatsappHint")} error={err("whatsapp")}>
        <Controller
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <PhoneInput
              id="whatsapp"
              value={field.value ?? ""}
              onChange={field.onChange}
              ref={field.ref}
              aria-invalid={!!errors.whatsapp}
              aria-describedby={describedBy("whatsapp", { hint: true, error: errors.whatsapp })}
            />
          )}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" id="logo-label">
          {t("logo")}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob/preview URL
              <img src={logoPreview} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-7 text-muted" aria-hidden />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} aria-describedby="logo-label">
              {logoPreview ? t("logoChange") : t("logoAdd")}
            </Button>
            {logoPreview && (
              <Button
                type="button"
                variant="danger-ghost"
                onClick={() => {
                  setLogoBlob(null);
                  setLogoPreview(null);
                  setLogoRemoved(true);
                }}
              >
                <Trash2 aria-hidden />
                {t("logoRemove")}
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted">{t("logoHint")}</p>
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
            reader.onload = () => setLogoSrc(String(reader.result));
            reader.readAsDataURL(f);
          }}
        />
      </div>

      <BottomSheet
        open={!!logoSrc}
        onOpenChange={(o) => !o && setLogoSrc(null)}
        title={t("cropTitle")}
        footer={
          <Button
            type="button"
            block
            size="lg"
            onClick={async () => {
              if (!logoSrc || !crop) return;
              const blob = await cropToBlob(logoSrc, crop, "image/webp", 0.9);
              setLogoBlob(blob);
              setLogoPreview(URL.createObjectURL(blob));
              setLogoRemoved(false);
              setLogoSrc(null);
            }}
          >
            {t("cropSave")}
          </Button>
        }
      >
        {logoSrc && <ImageCropper src={logoSrc} aspect={1} round onCropComplete={setCrop} />}
      </BottomSheet>

      {mode === "settings" ? (
        <div className="sticky bottom-0 -mx-4 mt-2 border-t border-line bg-sand/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <Button type="submit" size="lg" block loading={pending}>
            {ts("save")}
          </Button>
        </div>
      ) : (
        <StepFooter step={1} form="info-form" pending={pending} />
      )}
    </form>
  );
}
