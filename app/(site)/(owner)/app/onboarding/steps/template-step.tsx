"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { TemplateGallery } from "@/components/owner/template-gallery";
import type { RestaurantType } from "@/lib/dz/restaurant-types";
import { defaultTemplateFor, type TemplateKey } from "@/lib/templates/meta";
import { saveTemplate } from "../actions";
import { StepFooter } from "./step-footer";
import { StepHeader } from "./step-header";

export function TemplateStep({ current, type, name }: { current: string; type: RestaurantType; name: string }) {
  const t = useTranslations("onboarding.template");
  const [value, setValue] = React.useState<TemplateKey>(current as TemplateKey);
  const [pending, start] = React.useTransition();

  return (
    <form
      id="template-form"
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveTemplate({ templateKey: value });
        });
      }}
    >
      <StepHeader title={t("title")} subtitle={t("subtitle")} />
      <TemplateGallery value={value} onChange={setValue} suggested={defaultTemplateFor(type)} legend={t("title")} previewName={name} />
      <StepFooter step={2} form="template-form" pending={pending} />
    </form>
  );
}
