import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import { adminCategoryItems } from "@/lib/menu/admin-data";
import { createClient } from "@/lib/supabase/server";
import { CategoryForm } from "./category-form";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const data = await adminCategoryItems(restaurant.id, id).catch(() => null);
  if (!data) notFound();
  const supabase = await createClient();
  const { data: schedules } = await supabase.from("menu_schedules").select("id, name").eq("restaurant_id", restaurant.id).order("starts");
  const editable = canEditMenu(restaurant.status);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/app/menu/categories/${id}/items`} label={t("backToCategory")} />
      <h1 className="text-2xl font-bold">{t("editCategory")}</h1>
      {!editable && <LockedNotice />}
      <CategoryForm category={data.category} itemsCount={data.items.length} schedules={schedules ?? []} editable={editable} />
    </div>
  );
}
