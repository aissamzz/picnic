"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { reserveSlug, setTemplateActive } from "../actions";

export function TemplateToggle({ templateKey, active, label }: { templateKey: string; active: boolean; label: string }) {
  const [on, setOn] = React.useState(active);
  return (
    <Toggle
      aria-label={`${label} · ${templateKey}`}
      checked={on}
      onCheckedChange={async (v) => {
        setOn(v);
        const r = await setTemplateActive(templateKey, v);
        if (!r.ok) setOn(!v);
      }}
    />
  );
}

export function SlugsEditor({ slugs }: { slugs: string[] }) {
  const t = useTranslations("admin.templates");
  const tr = useTranslations();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await reserveSlug(value, true);
            if (!r.ok) return setError(r.error);
            setValue("");
          });
        }}
      >
        <Input aria-label={t("slugs")} placeholder={t("slugPlaceholder")} value={value} onChange={(e) => setValue(e.target.value.toLowerCase())} dir="ltr" className="max-w-xs" />
        <Button type="submit" disabled={!value.trim()} loading={pending}>
          {t("reserve")}
        </Button>
      </form>
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <ul className="flex flex-wrap gap-2">
        {slugs.map((s) => (
          <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface ps-3 text-sm" dir="ltr">
            {s}
            <button type="button" aria-label={t("release", { slug: s })} className="grid size-8 place-items-center text-muted hover:text-danger" onClick={() => start(async () => void (await reserveSlug(s, false)))}>
              <X className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
