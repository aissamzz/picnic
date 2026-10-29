import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Stepper } from "@/components/ui/stepper";
import { getMyRestaurant, requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ImportDraft } from "@/lib/ai/draft";
import type { Locale } from "@/lib/i18n/config";
import { InfoStep } from "../steps/info-step";
import { LanguagesStep } from "../steps/languages-step";
import { LiveStep } from "../steps/live-step";
import { MenuStep } from "../steps/menu-step";
import { ReviewStep } from "../steps/review-step";
import { TablesStep } from "../steps/tables-step";
import { TemplateStep } from "../steps/template-step";

export default async function OnboardingStepPage({ params, searchParams }: { params: Promise<{ step: string }>; searchParams: Promise<{ import?: string }> }) {
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > 7) notFound();

  const { profile } = await requireSession();
  const restaurant = await getMyRestaurant();
  if (!restaurant && step !== 1) redirect("/app/onboarding/1");
  if (restaurant && restaurant.role !== "owner") redirect("/app");

  const t = await getTranslations("onboarding");
  const tu = await getTranslations("ui");
  const steps = t.raw("steps") as string[];
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();

  let body: React.ReactNode = null;
  switch (step) {
    case 1: {
      const { data } = restaurant
        ? await supabase
            .from("restaurants")
            .select("name, slug, type, wilaya_code, commune, address, whatsapp_order_phone, logo_path")
            .eq("id", restaurant.id)
            .single()
        : { data: null };
      body = <InfoStep initial={data} accountPhone={profile.phone} locale={locale} />;
      break;
    }
    case 2: {
      const { data } = await supabase.from("restaurants").select("name, type, template_key").eq("id", restaurant!.id).single();
      body = <TemplateStep current={data!.template_key} type={data!.type} name={data!.name} />;
      break;
    }
    case 3: {
      const { data: categories } = await supabase
        .from("categories")
        .select("id, name, position, items(id, name, base_price, position, deleted_at)")
        .eq("restaurant_id", restaurant!.id)
        .is("deleted_at", null)
        .order("position");
      const { data: importsLeft } = await supabase.rpc("ai_imports_left", { p_restaurant_id: restaurant!.id });
      body = (
        <MenuStep
          importsLeft={importsLeft ?? null}
          categories={(categories ?? []).map((c) => ({ ...c, items: c.items.filter((i) => !i.deleted_at).sort((a, b) => a.position - b.position) }))}
        />
      );
      break;
    }
    case 4: {
      // AI review: the import picked in step 3 (or the latest one not yet added).
      const wanted = (await searchParams).import;
      let query = supabase.from("ai_imports").select("id, result").eq("restaurant_id", restaurant!.id).eq("status", "done").is("applied_at", null);
      if (wanted && /^[0-9a-f-]{36}$/i.test(wanted)) query = query.eq("id", wanted);
      const { data: pending } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!pending) redirect("/app/onboarding/3");
      body = <ReviewStep importId={pending.id} draft={pending.result as unknown as ImportDraft} />;
      break;
    }
    case 5: {
      const [{ data: categories }, { data: items }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("restaurant_id", restaurant!.id).is("deleted_at", null).order("position"),
        supabase.from("items").select("id, name").eq("restaurant_id", restaurant!.id).is("deleted_at", null).order("position"),
      ]);
      body = (
        <LanguagesStep
          enabled={restaurant!.enabled_locales as Locale[]}
          defaultLocale={restaurant!.default_locale as Locale}
          entries={[
            ...(categories ?? []).map((c) => ({ kind: "category" as const, id: c.id, name: c.name as Record<string, string> })),
            ...(items ?? []).map((i) => ({ kind: "item" as const, id: i.id, name: i.name as Record<string, string> })),
          ]}
        />
      );
      break;
    }
    case 6: {
      const { count } = await supabase
        .from("tables")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant!.id)
        .eq("is_active", true);
      body = <TablesStep initialCount={count ?? 0} restaurantLocale={restaurant!.default_locale as Locale} />;
      break;
    }
    case 7:
      body = <LiveStep slug={restaurant!.slug} />;
      break;
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} current={step - 1} label={tu("stepOf", { current: step, total: steps.length })} />
      {body}
    </div>
  );
}
