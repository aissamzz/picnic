import { getTranslations } from "next-intl/server";
import { BackLink } from "@/components/owner/back-link";
import { canEditMenu, LockedNotice } from "@/components/owner/locked-notice";
import { requireRestaurant } from "@/lib/auth/session";
import { adminFullMenu } from "@/lib/menu/admin-data";
import { TranslationsEditor, type Row } from "./translations-editor";

export default async function TranslationsPage() {
  const restaurant = await requireRestaurant();
  const t = await getTranslations("menuAdmin");
  const menu = await adminFullMenu(restaurant.id);
  const editable = canEditMenu(restaurant.status);
  // One row per translatable text, in menu order.
  const rows: Row[] = menu.flatMap((c) => [
    { kind: "category" as const, id: c.id, field: "name" as const, text: c.name },
    ...c.items.flatMap((i) => [
      { kind: "item" as const, id: i.id, field: "name" as const, text: i.name },
      ...(i.description.fr || i.description.ar ? [{ kind: "item" as const, id: i.id, field: "description" as const, text: i.description }] : []),
      ...i.variants.map((v) => ({ kind: "variant" as const, id: v.id, field: "name" as const, text: v.name })),
      ...i.extras.map((x) => ({ kind: "extra" as const, id: x.id, field: "name" as const, text: x.name })),
    ]),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/app/menu" label={t("backToMenu")} />
      <div>
        <h1 className="text-2xl font-bold">{t("translations.title")}</h1>
        <p className="text-muted">{t("translations.subtitle")}</p>
      </div>
      {!editable && <LockedNotice />}
      <TranslationsEditor rows={rows} editable={editable} />
    </div>
  );
}
