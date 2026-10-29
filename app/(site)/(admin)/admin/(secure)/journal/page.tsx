import { Download } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auditEntries, type AuditFilters } from "./query";

export default async function AuditLog({ searchParams }: { searchParams: Promise<AuditFilters & { n?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations("admin.audit");
  const f = await getFormatter();
  const limit = Math.min(1000, Math.max(100, Number(sp.n) || 100));
  const rows = await auditEntries(sp, limit);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "n") as [string, string][]).toString();
  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted">{t("subtitle")}</p>
      </div>
      <form className="flex flex-wrap items-end gap-2" method="get">
        <label className="flex flex-col gap-1 text-sm">
          {t("action")}
          <Input name="action" defaultValue={sp.action} placeholder="payment." className="w-44" dir="ltr" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("restaurant")}
          <Input name="restaurant" defaultValue={sp.restaurant} className="w-52" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("from")}
          <Input type="date" name="from" defaultValue={sp.from} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("to")}
          <Input type="date" name="to" defaultValue={sp.to} className="w-40" />
        </label>
        <Button type="submit" variant="secondary">
          {t("filter")}
        </Button>
        <a href={`/admin/journal/export${qs ? `?${qs}` : ""}`} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-primary">
          <Download className="size-4" aria-hidden />
          {t("export")}
        </a>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{t("title")}</caption>
          <thead className="border-b border-line text-start text-muted">
            <tr>
              {(["when", "who", "action", "restaurant", "details"] as const).map((c) => (
                <th key={c} scope="col" className="px-3 py-2 text-start font-medium">
                  {t(`columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted">
                  {t("empty")}
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap tabular">{f.dateTime(new Date(e.created_at), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-3 py-2">{e.actor ?? t("system")}</td>
                <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                  {e.action}
                </td>
                <td className="px-3 py-2">{e.restaurant ? <Link href={`/admin/restaurants/${e.restaurant.id}`} className="hover:underline">{e.restaurant.name}</Link> : "–"}</td>
                <td className="max-w-md truncate px-3 py-2 font-mono text-xs text-muted" dir="ltr" title={JSON.stringify(e.payload)}>
                  {JSON.stringify(e.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {rows.length === limit && limit < 1000 && (
        <Link href={`/admin/journal?${qs}${qs ? "&" : ""}n=${limit + 200}`} className="self-center text-sm font-semibold text-primary">
          {t("more")}
        </Link>
      )}
    </div>
  );
}
