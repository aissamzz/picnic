"use client";

import { Download, Plus, QrCode, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { downloadBlob, renderPoster } from "@/lib/qr/poster";
import { addTable, deleteTable, updateTable } from "./actions";

type Table = { id: string; code: string; label: string; zone: string | null; is_active: boolean };

export function TablesEditor({
  tables,
  editable,
  restaurantName,
  tableUrl,
  labelTemplate,
}: {
  tables: Table[];
  editable: boolean;
  restaurantName: string;
  tableUrl: string;
  labelTemplate: string;
}) {
  const t = useTranslations("owner.tables");
  const tr = useTranslations();
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [adding, startAdd] = React.useTransition();
  const [confirm, setConfirm] = React.useState<Table | null>(null);
  const [deleting, startDelete] = React.useTransition();

  return (
    <div className="flex flex-col gap-3">
      <FormAlert>{error && tr(error as never)}</FormAlert>
      <p className="text-sm text-muted">{t("count", { count: tables.length })}</p>
      {tables.length === 0 && <EmptyState icon={<QrCode />} title={t("empty")} />}
      {tables.map((table) => (
        <TableRow
          key={table.id}
          table={table}
          editable={editable}
          restaurantName={restaurantName}
          tableUrl={tableUrl}
          onError={setError}
          onDelete={() => setConfirm(table)}
        />
      ))}
      {editable && (
        <Button
          variant="soft"
          size="lg"
          loading={adding}
          onClick={() =>
            startAdd(async () => {
              const r = await addTable(labelTemplate);
              if (!r.ok) return setError(r.error);
              router.refresh();
            })
          }
        >
          <Plus aria-hidden />
          {t("add")}
        </Button>
      )}
      <BottomSheet
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? t("delete", { name: confirm.label }) : ""}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(null)}>
              {tr("ui.cancel")}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={deleting}
              onClick={() =>
                startDelete(async () => {
                  const table = confirm!;
                  const r = await deleteTable(table.id);
                  setConfirm(null);
                  if (!r.ok) return setError(r.error);
                  toast(t("deleted", { name: table.label }));
                  router.refresh();
                })
              }
            >
              {tr("ui.confirm")}
            </Button>
          </div>
        }
      />
    </div>
  );
}

function TableRow({
  table,
  editable,
  restaurantName,
  tableUrl,
  onError,
  onDelete,
}: {
  table: Table;
  editable: boolean;
  restaurantName: string;
  tableUrl: string;
  onError: (e: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("owner.tables");
  const locale = useLocale();
  const router = useRouter();
  const [label, setLabel] = React.useState(table.label);
  const [zone, setZone] = React.useState(table.zone ?? "");
  const [active, setActive] = React.useState(table.is_active);
  const [saving, start] = React.useTransition();
  const [qrBusy, setQrBusy] = React.useState(false);
  const dirty = label !== table.label || zone !== (table.zone ?? "") || active !== table.is_active;
  const id = `t-${table.id}`;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">
          {t("code")} <bdi dir="ltr">{table.code}</bdi>
        </span>
        <label className="flex items-center gap-2 text-sm">
          {t("active")}
          <Toggle checked={active} onCheckedChange={setActive} disabled={!editable} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-label`} label={t("label")}>
          <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} disabled={!editable} />
        </Field>
        <Field id={`${id}-zone`} label={t("zone")}>
          <Input id={`${id}-zone`} value={zone} placeholder={t("zonePlaceholder")} onChange={(e) => setZone(e.target.value)} disabled={!editable} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          loading={qrBusy}
          onClick={async () => {
            setQrBusy(true);
            try {
              const blob = await renderPoster({
                width: 1200,
                height: 1500,
                qrText: `${tableUrl}?t=${encodeURIComponent(table.code)}`,
                title: restaurantName,
                headline: label,
                footer: t("scanToSee"),
                bg: "#F6F4EF",
                fg: "#1C1B19",
                rtl: locale === "ar",
              });
              downloadBlob(blob, `qr-${table.code}.png`);
            } finally {
              setQrBusy(false);
            }
          }}
        >
          <Download aria-hidden />
          {t("downloadPng", { name: label })}
        </Button>
        {editable && (
          <>
            <Button variant="danger-ghost" size="icon" aria-label={t("delete", { name: table.label })} onClick={onDelete} className="ms-auto">
              <Trash2 />
            </Button>
            {dirty && (
              <Button
                loading={saving}
                onClick={() =>
                  start(async () => {
                    const r = await updateTable({ id: table.id, label, zone, isActive: active });
                    if (!r.ok) return onError(r.fieldErrors?.label ?? r.error);
                    router.refresh();
                  })
                }
              >
                {t("save")}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
