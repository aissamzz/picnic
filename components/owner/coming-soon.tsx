import { Hammer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/states";

export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("comingSoon");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <EmptyState icon={<Hammer />} title={t("title")} description={t("body")} />
    </div>
  );
}
