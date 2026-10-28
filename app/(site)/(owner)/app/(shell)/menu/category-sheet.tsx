"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveCategory } from "./actions";

/** Create a category (FR and/or AR name). */
export function CategorySheet({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: (id: string) => void }) {
  const t = useTranslations("menuAdmin");
  const ti = useTranslations("onboarding.import");
  const tr = useTranslations();
  const [fr, setFr] = React.useState("");
  const [ar, setAr] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveCategory({ name: { fr, ar } });
      if (!r.ok) return setError(r.fieldErrors?.["name.fr"] ?? r.error);
      setFr("");
      setAr("");
      onSaved(r.data.id);
    });
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("newCategory")}
      footer={
        <Button block size="lg" loading={pending} onClick={submit}>
          {t("addCategory")}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FormAlert>{error && tr(error as never)}</FormAlert>
        <Field id="cat-fr" label={ti("categoryName")}>
          <Input id="cat-fr" lang="fr" dir="ltr" value={fr} onChange={(e) => setFr(e.target.value)} placeholder={ti("examples")} />
        </Field>
        <Field id="cat-ar" label={ti("categoryNameAr")}>
          <Input id="cat-ar" lang="ar" dir="rtl" value={ar} onChange={(e) => setAr(e.target.value)} />
        </Field>
      </form>
    </BottomSheet>
  );
}
