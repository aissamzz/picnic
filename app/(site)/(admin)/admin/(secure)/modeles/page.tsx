import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SlugsEditor, TemplateToggle } from "./editors";

export default async function TemplatesPage() {
  const t = await getTranslations("admin.templates");
  const tt = await getTranslations("templates");
  const supabase = await createClient();
  const [{ data: templates }, { data: slugs }, { data: restaurants }] = await Promise.all([
    supabase.from("templates").select("key, is_active").order("key"),
    supabase.from("reserved_slugs").select("slug").order("slug"),
    supabase.from("restaurants").select("template_key").is("deleted_at", null),
  ]);
  const used = new Map<string, number>();
  for (const r of restaurants ?? []) used.set(r.template_key, (used.get(r.template_key) ?? 0) + 1);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("templates")}</h2>
        <ul className="grid gap-2 md:grid-cols-3">
          {(templates ?? []).map((x) => (
            <li key={x.key} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3">
              <span>
                <span className="block font-semibold">{tt.has(`${x.key}.name`) ? tt(`${x.key}.name` as never) : x.key}</span>
                <span className="text-xs text-muted">{t("inUse", { count: used.get(x.key) ?? 0 })}</span>
              </span>
              <TemplateToggle templateKey={x.key} active={x.is_active} label={t("active")} />
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("slugs")}</h2>
        <p className="text-sm text-muted">{t("slugsHint")}</p>
        <SlugsEditor slugs={(slugs ?? []).map((s) => s.slug)} />
      </section>
    </div>
  );
}
