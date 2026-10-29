import { requireSuperAdmin } from "@/lib/auth/session";
import { auditEntries } from "../query";

const cell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  // Quote everything; neutralize spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Filtered audit log as CSV (UTF-8 with BOM for Excel), up to 10 000 rows. */
export async function GET(request: Request) {
  await requireSuperAdmin();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const rows = await auditEntries(sp, 10_000);
  const lines = [
    ["date", "actor", "action", "restaurant", "slug", "payload"].map(cell).join(","),
    ...rows.map((e) => [e.created_at, e.actor ?? "system", e.action, e.restaurant?.name, e.restaurant?.slug, e.payload].map(cell).join(",")),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="liinky-journal-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
