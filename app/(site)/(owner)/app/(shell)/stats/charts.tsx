"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { Stats } from "./stats-view";

// Validated pair (lightness, chroma, CVD ΔE 8.6, ≥3:1 on white): tables / order link.
const TABLE = "#1a7a4c";
const ORDER = "#c27a0e";
const axis = { fontSize: 12, fill: "var(--muted)" };

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export default function Charts({ days, hours }: Pick<Stats, "days" | "hours">) {
  const t = useTranslations("owner.stats");
  const format = useFormatter();
  const dayLabel = (d: string) => format.dateTime(new Date(`${d}T12:00:00`), { day: "numeric", month: "short" });
  const tooltip = {
    cursor: { fill: "var(--sand)" },
    contentStyle: { borderRadius: 12, border: "1px solid var(--line)", fontSize: 13 },
  };

  return (
    <div className="grid gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("perDay")}</h2>
          <Legend items={[{ color: TABLE, label: t("tableVisits") }, { color: ORDER, label: t("orderVisits") }]} />
        </div>
        <div className="h-56" dir="ltr" role="img" aria-label={t("perDay")}>
          <ResponsiveContainer>
            <BarChart data={days} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="day" tickFormatter={dayLabel} tick={axis} tickLine={false} axisLine={false} minTickGap={12} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tooltip} labelFormatter={(d) => dayLabel(String(d))} />
              <Bar dataKey="table" name={t("tableVisits")} stackId="v" fill={TABLE} stroke="var(--surface)" strokeWidth={1} />
              <Bar dataKey="order" name={t("orderVisits")} stackId="v" fill={ORDER} stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{t("peakHours")}</h2>
        <div className="h-44" dir="ltr" role="img" aria-label={t("peakHours")}>
          <ResponsiveContainer>
            <BarChart data={hours} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="15%">
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="hour" tick={axis} tickLine={false} axisLine={false} interval={2} tickFormatter={(h) => `${h}h`} />
              <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
              <Tooltip {...tooltip} labelFormatter={(h) => t("hourLabel", { h: String(h) })} />
              <Bar dataKey="visits" name={t("visits")} fill={TABLE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
