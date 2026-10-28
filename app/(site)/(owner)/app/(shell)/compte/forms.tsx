"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { newPasswordSchema } from "@/lib/validation/auth";
import { changePassword, updateName } from "./actions";

export function NameForm({ defaultName }: { defaultName: string }) {
  const t = useTranslations("account");
  const tr = useTranslations();
  const [pending, start] = useTransition();
  const form = useForm<{ fullName: string }>({
    resolver: zodResolver(z.object({ fullName: z.string().trim().min(2, "errors.required").max(80) })),
    defaultValues: { fullName: defaultName },
  });
  const err = form.formState.errors.fullName?.message;
  return (
    <form
      noValidate
      className="flex items-end gap-2"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await updateName(v);
          if (r.ok) toast(t("nameSaved"));
          else applyServerErrors(r, form.setError);
        }),
      )}
    >
      <Field id="fullName" label={t("name")} error={err && tr(err as never)} className="flex-1">
        <Input id="fullName" autoComplete="name" aria-invalid={!!err} aria-describedby={describedBy("fullName", { error: err })} {...form.register("fullName")} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className={err ? "mb-7" : undefined}>
        {tr("ui.save")}
      </Button>
    </form>
  );
}

type PasswordValues = z.input<typeof newPasswordSchema>;

export function PasswordForm() {
  const t = useTranslations("account");
  const tf = useTranslations("auth.forgot");
  const tr = useTranslations();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PasswordValues>({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", passwordConfirm: "" } });
  const { errors } = form.formState;
  const err = (k: keyof PasswordValues) => (errors[k]?.message ? tr(errors[k]!.message as never) : undefined);
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          setFormError(null);
          const r = await changePassword(v);
          if (r.ok) {
            toast(t("passwordSaved"));
            form.reset();
          } else setFormError(applyServerErrors(r, form.setError));
        }),
      )}
    >
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <Field id="password" label={tf("newPassword")} hint={tr("auth.signup.passwordHint")} error={err("password")}>
        <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby={describedBy("password", { hint: true, error: errors.password })} {...form.register("password")} />
      </Field>
      <Field id="passwordConfirm" label={tf("newPasswordConfirm")} error={err("passwordConfirm")}>
        <PasswordInput id="passwordConfirm" autoComplete="new-password" aria-invalid={!!errors.passwordConfirm} aria-describedby={describedBy("passwordConfirm", { error: errors.passwordConfirm })} {...form.register("passwordConfirm")} />
      </Field>
      <Button type="submit" loading={pending} className="self-start">
        {tf("save")}
      </Button>
    </form>
  );
}
