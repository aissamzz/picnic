"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { signupSchema } from "@/lib/validation/auth";
import { signUp } from "../actions";

type Values = z.input<typeof signupSchema>;

export function SignupForm({ next }: { next?: string }) {
  const t = useTranslations("auth.signup");
  const tr = useTranslations();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", phone: "", password: "", passwordConfirm: "" },
  });
  const { errors } = form.formState;
  const err = (k: keyof Values) => (errors[k]?.message ? tr(errors[k]!.message as never) : undefined);

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setFormError(null);
      const result = await signUp(values, next);
      if (result) setFormError(applyServerErrors(result, form.setError));
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <Field id="fullName" label={t("fullName")} error={err("fullName")}>
        <Input
          id="fullName"
          autoComplete="name"
          aria-invalid={!!errors.fullName}
          aria-describedby={describedBy("fullName", { error: errors.fullName })}
          {...form.register("fullName")}
        />
      </Field>
      <Field id="phone" label={t("phone")} hint={t("phoneHint")} error={err("phone")}>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <PhoneInput
              id="phone"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={!!errors.phone}
              aria-describedby={describedBy("phone", { hint: true, error: errors.phone })}
            />
          )}
        />
      </Field>
      <Field id="password" label={t("password")} hint={t("passwordHint")} error={err("password")}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", { hint: true, error: errors.password })}
          {...form.register("password")}
        />
      </Field>
      <Field id="passwordConfirm" label={t("passwordConfirm")} error={err("passwordConfirm")}>
        <PasswordInput
          id="passwordConfirm"
          autoComplete="new-password"
          aria-invalid={!!errors.passwordConfirm}
          aria-describedby={describedBy("passwordConfirm", { error: errors.passwordConfirm })}
          {...form.register("passwordConfirm")}
        />
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {t("submit")}
      </Button>
      <p className="text-xs text-muted">
        {t.rich("terms", {
          terms: (c) => (
            <Link href="/conditions" className="underline underline-offset-2">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link href="/confidentialite" className="underline underline-offset-2">
              {c}
            </Link>
          ),
        })}
      </p>
      <p className="text-center text-sm">
        {t("haveAccount")}{" "}
        <Link href={next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion"} className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
