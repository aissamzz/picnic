import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("admin.settings");
  const { data } = await (await createClient()).from("platform_settings").select("*").single();
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {data && <SettingsForm initial={data} />}
    </div>
  );
}
