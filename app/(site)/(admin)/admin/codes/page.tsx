import { getTranslations } from "next-intl/server";
import { listCodeRequests } from "./actions";
import { CodesBoard } from "./codes-board";

export default async function AdminCodesPage() {
  const t = await getTranslations("admin.codes");
  const initial = await listCodeRequests();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <CodesBoard initial={initial} />
    </div>
  );
}
