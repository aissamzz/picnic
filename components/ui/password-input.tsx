"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Input, type InputProps } from "./input";

/** Password field with a show/hide toggle. Always LTR. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "end">>((props, ref) => {
  const t = useTranslations("ui");
  const [shown, setShown] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={shown ? "text" : "password"}
      dir="ltr"
      end={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:text-ink"
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          aria-pressed={shown}
        >
          {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = "PasswordInput";
