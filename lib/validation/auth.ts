import { z } from "zod";
import { normalizeDzPhone } from "@/lib/utils/phone";

/**
 * Error messages are i18n keys under "errors" so client and server show
 * the same translated text.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "errors.required")
  .transform((v, ctx) => {
    const e164 = normalizeDzPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "errors.phoneInvalid" });
      return z.NEVER;
    }
    return e164;
  });

export const passwordSchema = z.string().min(8, "errors.passwordTooShort").max(72, "errors.passwordTooLong");

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "errors.required").max(80),
    phone: phoneSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "errors.passwordMismatch" });

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "errors.required"),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "errors.passwordMismatch" });

export const codeSchema = z.string().trim().regex(/^\d{6}$/, "errors.codeFormat");

export const resetSchema = z
  .object({ requestId: z.guid(), code: codeSchema, password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, { path: ["passwordConfirm"], message: "errors.passwordMismatch" });
