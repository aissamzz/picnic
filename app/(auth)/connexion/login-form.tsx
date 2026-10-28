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
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { loginSchema } from "@/lib/validation/auth";
import { signIn } from "../actions";

type Values = z.input<typeof loginSchema>;

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth.login");
  const ts = useTranslations("auth.signup");
  const tr = useTranslations();
  const [pending, start] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { phone: "", password: "" } });
  const { errors } = form.formState;
  const err = (k: keyof Values) => (errors[k]?.message ? tr(errors[k]!.message as never) : undefined);

  const onSubmit = form.handleSubmit((values) =>
    start(async () => {
      setFormError(null);
      const result = await signIn(values, next);
      if (result) setFormError(applyServerErrors(result, form.setError));
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <Field id="phone" label={ts("phone")} error={err("phone")}>
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
              autoComplete="username"
              aria-invalid={!!errors.phone}
              aria-describedby={describedBy("phone", { error: errors.phone })}
            />
          )}
        />
      </Field>
      <Field id="password" label={ts("password")} error={err("password")}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", { error: errors.password })}
          {...form.register("password")}
        />
      </Field>
      <Link href="/mot-de-passe-oublie" className="-mt-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline">
        {t("forgot")}
      </Link>
      <Button type="submit" size="lg" block loading={pending}>
        {t("submit")}
      </Button>
      <p className="text-center text-sm">
        {t("noAccount")}{" "}
        <Link href={next ? `/inscription?next=${encodeURIComponent(next)}` : "/inscription"} className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("signup")}
        </Link>
      </p>
    </form>
  );
}
