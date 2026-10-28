"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { CodeRequestPanel } from "@/components/forms/code-request-panel";
import { FormAlert } from "@/components/forms/form-alert";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { describedBy, Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { codeSchema, newPasswordSchema, phoneSchema } from "@/lib/validation/auth";
import { getResetStatus, requestPasswordReset, resetPassword } from "../actions";

const STORAGE_KEY = "liinky.reset";
type Pending = { requestId: string; phone: string };

function load(): Pending | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}
function save(p: Pending | null) {
  try {
    if (p) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the flow still works without resume */
  }
}

export function ForgotFlow() {
  const t = useTranslations("auth.forgot");
  const tr = useTranslations();
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [requesting, startRequest] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => setPending(load()), []);

  const phoneForm = useForm<{ phone: string }>({
    resolver: zodResolver(z.object({ phone: phoneSchema })),
    defaultValues: { phone: "" },
  });

  function request(phone: string) {
    startRequest(async () => {
      setFormError(null);
      const result = await requestPasswordReset({ phone });
      if (!result.ok) {
        setFormError(applyServerErrors(result, phoneForm.setError));
        return;
      }
      save(result.data);
      setPending(result.data);
    });
  }

  if (!pending) {
    const err = phoneForm.formState.errors.phone?.message;
    return (
      <form onSubmit={phoneForm.handleSubmit((v) => request(v.phone))} noValidate className="flex flex-col gap-4">
        <FormAlert>{formError && tr(formError as never)}</FormAlert>
        <Field id="phone" label={tr("auth.signup.phone")} error={err && tr(err as never)}>
          <Controller
            control={phoneForm.control}
            name="phone"
            render={({ field }) => (
              <PhoneInput
                id="phone"
                value={field.value}
                onChange={field.onChange}
                ref={field.ref}
                aria-invalid={!!err}
                aria-describedby={describedBy("phone", { error: err })}
              />
            )}
          />
        </Field>
        <Button type="submit" size="lg" block loading={requesting}>
          {t("submit")}
        </Button>
        <Link href="/connexion" className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CodeRequestPanel
        key={pending.requestId}
        phone={pending.phone}
        poll={() => getResetStatus(pending.requestId)}
        onRequestAgain={() => request(pending.phone)}
        requestAgainPending={requesting}
      >
        <ResetForm pending={pending} />
      </CodeRequestPanel>
      <button
        type="button"
        className="min-h-11 text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => {
          save(null);
          setPending(null);
        }}
      >
        {t("changeNumber")}
      </button>
    </div>
  );
}

const resetFormSchema = z.intersection(z.object({ code: codeSchema }), newPasswordSchema);
type ResetValues = z.input<typeof resetFormSchema>;

function ResetForm({ pending: request }: { pending: Pending }) {
  const t = useTranslations("auth.forgot");
  const tc = useTranslations("code");
  const tr = useTranslations();
  const [pending, start] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { code: "", password: "", passwordConfirm: "" },
  });
  const { errors } = form.formState;
  const err = (k: keyof ResetValues) => (errors[k]?.message ? tr(errors[k]!.message as never) : undefined);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          setFormError(null);
          // Success redirects away; clear the resumable request first, restore it on error.
          save(null);
          const result = await resetPassword({ requestId: request.requestId, ...v });
          if (result && !result.ok) {
            save(request);
            setFormError(applyServerErrors(result, form.setError));
          }
        }),
      )}
    >
      <FormAlert>{formError && tr(formError as never)}</FormAlert>
      <Field id="code" label={tc("code")} error={err("code")}>
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <CodeInput
              id="code"
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
              aria-invalid={!!errors.code}
              aria-describedby={describedBy("code", { error: errors.code })}
            />
          )}
        />
      </Field>
      <Field id="password" label={t("newPassword")} hint={tr("auth.signup.passwordHint")} error={err("password")}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          aria-describedby={describedBy("password", { hint: true, error: errors.password })}
          {...form.register("password")}
        />
      </Field>
      <Field id="passwordConfirm" label={t("newPasswordConfirm")} error={err("passwordConfirm")}>
        <PasswordInput
          id="passwordConfirm"
          autoComplete="new-password"
          aria-invalid={!!errors.passwordConfirm}
          aria-describedby={describedBy("passwordConfirm", { error: errors.passwordConfirm })}
          {...form.register("passwordConfirm")}
        />
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
