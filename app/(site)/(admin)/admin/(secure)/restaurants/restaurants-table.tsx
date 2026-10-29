"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { DataTable } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { wilayaLabel } from "@/lib/dz/wilayas";
import { statusTone } from "@/lib/subscription/state";
import type { Database } from "@/lib/supabase/types";
import { formatDzPhone } from "@/lib/utils/phone";

export type AdminRestaurant = Database["public"]["Functions"]["admin_restaurants"]["Returns"][number];
const STATUSES = ["trial", "active", "grace", "expired", "suspended", "paused"] as const;

export function RestaurantsTable({ rows }: { rows: AdminRestaurant[] }) {
  const t = useTranslations("admin.restaurants");
  const ts = useTranslations("status");
  const to = useTranslations("admin.detail.outcomes");
  const f = useFormatter();
  const locale = useLocale() as "fr" | "ar";
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "").replace(/^0/, "");
    return rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!needle ||
          r.name.toLowerCase().includes(needle) ||
          r.slug.includes(needle) ||
          (r.commune ?? "").toLowerCase().includes(needle) ||
          (digits.length >= 4 && (r.owner_phone ?? "").includes(digits))),
    );
  }, [rows, q, status]);

  const date = (iso: string | null) => (iso ? f.dateTime(new Date(iso), { day: "numeric", month: "short", year: "2-digit" }) : "–");
  const columns: ColumnDef<AdminRestaurant, unknown>[] = [
    {
      accessorKey: "name",
      header: t("columns.name"),
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="font-semibold">{row.original.name}</span>
          <span className="text-xs text-muted" dir="ltr">
            /{row.original.slug}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "owner_name",
      header: t("columns.owner"),
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span>{row.original.owner_name ?? "–"}</span>
          {row.original.owner_phone && (
            <bdi dir="ltr" className="text-xs text-muted tabular">
              {formatDzPhone("+" + row.original.owner_phone.replace(/^\+/, ""))}
            </bdi>
          )}
        </span>
      ),
    },
    { accessorKey: "status", header: t("columns.status"), cell: ({ row }) => <StatusPill tone={statusTone(row.original.status)}>{ts(row.original.status)}</StatusPill> },
    { accessorKey: "wilaya_code", header: t("columns.wilaya"), cell: ({ row }) => (row.original.wilaya_code ? wilayaLabel(row.original.wilaya_code, locale) : "–") },
    { accessorKey: "visits_7d", header: t("columns.visits7"), cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
    { accessorKey: "visits_30d", header: t("columns.visits30"), cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
    { accessorKey: "items", header: t("columns.items"), cell: ({ getValue }) => <span className="tabular">{getValue() as number}</span> },
    {
      id: "ends",
      accessorFn: (r) => r.paid_until ?? r.trial_ends_at,
      header: t("columns.ends"),
      cell: ({ row }) => <span className="tabular">{date(row.original.paid_until ?? row.original.trial_ends_at)}</span>,
    },
    { accessorKey: "created_at", header: t("columns.created"), cell: ({ getValue }) => <span className="tabular">{date(getValue() as string)}</span> },
    {
      accessorKey: "last_call_at",
      header: t("columns.lastCall"),
      cell: ({ row }) => (row.original.last_call_outcome ? `${to(row.original.last_call_outcome)} · ${date(row.original.last_call_at)}` : "–"),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select aria-label={t("status")} value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="">{t("all")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ts(s)}
            </option>
          ))}
        </Select>
        <span className="text-sm text-muted" aria-live="polite">
          {t("count", { count: filtered.length })}
        </span>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        caption={t("title")}
        empty={t("empty")}
        initialSorting={[{ id: "visits_7d", desc: true }]}
        onRowClick={(r) => router.push(`/admin/restaurants/${r.id}`)}
      />
    </div>
  );
}
