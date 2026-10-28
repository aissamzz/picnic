"use client";

import {
  Bell,
  CookingPot,
  Eye,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { OfflineBanner, SubscriptionBanner, type SubscriptionBannerState } from "@/components/ui/banners";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { describedBy, Field } from "@/components/ui/field";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Input, Select, Textarea } from "@/components/ui/input";
import { KabyleBand } from "@/components/ui/kabyle-band";
import { KanbanBoard, KanbanCard, KanbanColumn } from "@/components/ui/kanban";
import { LanguagePicker } from "@/components/ui/language-picker";
import { Ltr } from "@/components/ui/ltr";
import { PhoneInput } from "@/components/ui/phone-input";
import { Price } from "@/components/ui/price";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { StatusPill } from "@/components/ui/status-pill";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast, toastWithUndo } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { UploadZone } from "@/components/ui/upload-zone";
import { formatPrice } from "@/lib/price";
import type { Locale } from "@/lib/i18n/config";

const swatches = [
  ["ink", "#1C1B19"],
  ["sand", "#F6F4EF"],
  ["surface", "#FFFFFF"],
  ["line", "#E7E3DA"],
  ["muted", "#5E5A53"],
  ["primary", "#1F6B4A"],
  ["primary-soft", "#E3F0E8"],
  ["accent", "#F2B441"],
  ["clay", "#9C3D24"],
  ["success", "#1F7A3D"],
  ["warning", "#A15C00"],
  ["warning-soft", "#FFF2DC"],
  ["danger", "#B42318"],
  ["danger-soft", "#FDECEA"],
  ["info", "#1D4F91"],
  ["info-soft", "#EAF0FB"],
] as const;

// Neutral placeholder for the cropper demo (no network image needed).
const sampleImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#9C3D24"/><circle cx="400" cy="300" r="190" fill="#F2B441"/><circle cx="400" cy="300" r="150" fill="#F6F4EF"/><text x="400" y="320" font-family="sans-serif" font-size="64" text-anchor="middle" fill="#1C1B19">LOGO</text></svg>`,
  );

type Row = { name: string; wilaya: string; visits: number; status: "trial" | "active" | "expired" };
const rows: Row[] = [
  { name: "Pizzeria Roma", wilaya: "18 · Jijel", visits: 1284, status: "active" },
  { name: "Café El Bahia", wilaya: "06 · Béjaïa", visits: 642, status: "trial" },
  { name: "Grill Sétif", wilaya: "19 · Sétif", visits: 97, status: "expired" },
];
const statusTone = { trial: "info", active: "success", expired: "danger" } as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase({ title, subtitle }: { title: string; subtitle: string }) {
  const t = useTranslations("dev");
  const s = useTranslations("dev.sample");
  const ui = useTranslations("ui");
  const st = useTranslations("status");
  const locale = useLocale() as Locale;

  const [phone, setPhone] = React.useState("555123456");
  const [name, setName] = React.useState("");
  const [chip, setChip] = React.useState(0);
  const [visible, setVisible] = React.useState(true);
  const [soldOut, setSoldOut] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [kit, setKit] = React.useState<Record<string, string>>({
    roma: "ordered",
    bahia: "mockup",
    grill: "printed",
  });
  const chips = s.raw("chips") as string[];
  const steps = s.raw("steps") as string[];

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: s("colName"), cell: ({ getValue }) => <bdi>{String(getValue())}</bdi> },
      { accessorKey: "wilaya", header: s("colWilaya"), cell: ({ getValue }) => <bdi>{String(getValue())}</bdi> },
      {
        accessorKey: "visits",
        header: s("colVisits"),
        cell: ({ getValue }) => <span className="tabular">{String(getValue())}</span>,
      },
      {
        accessorKey: "status",
        header: s("colStatus"),
        enableSorting: false,
        cell: ({ row }) => <StatusPill tone={statusTone[row.original.status]}>{st(row.original.status)}</StatusPill>,
      },
    ],
    [s, st],
  );

  function markSoldOut() {
    setSoldOut(true);
    toastWithUndo(s("toastSoldOut"), {
      undoLabel: ui("undo"),
      onUndo: () => {
        setSoldOut(false);
        toast(s("toastUndone"));
      },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted">{subtitle}</p>
          <p className="mt-1 text-sm text-muted">
            {t("direction")}: <code dir="ltr">{locale === "ar" ? "rtl" : "ltr"}</code>
          </p>
        </div>
        <LanguagePicker />
      </header>

      <Section id="colors" title={t("sections.colors")}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {swatches.map(([token, hex]) => (
            <li key={token} className="flex items-center gap-2 rounded-md border border-line bg-surface p-2">
              <span className="size-10 shrink-0 rounded-md border border-line" style={{ background: hex }} />
              <span className="flex flex-col text-xs" dir="ltr">
                <span className="font-semibold">{token}</span>
                <span className="text-muted">{hex}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title={t("sections.type")}>
        <Card>
          <CardContent className="flex flex-col gap-2 pt-4">
            <p className="text-3xl font-bold">{s("restaurant")}</p>
            <p>{s("body")}</p>
            <p className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{s("dish")}</span>
              <Price amount={1100} className="font-semibold" />
              <Price amount={1500} className="text-muted" />
              <Price amount={120000} className="text-muted" />
            </p>
            <p className="text-sm text-muted">
              {s.rich("rtlNote", {
                phone: (chunks) => <Ltr>{chunks}</Ltr>,
                url: (chunks) => <Ltr>{chunks}</Ltr>,
              })}
            </p>
            <p className="text-sm text-muted">
              {s("priceNote")} · <bdi dir="ltr">{formatPrice(800, locale, { hideCurrency: true })}</bdi>
            </p>
          </CardContent>
        </Card>
      </Section>

      <Section id="buttons" title={t("sections.buttons")}>
        <div className="flex flex-wrap gap-2">
          <Button>{s("primary")}</Button>
          <Button variant="secondary">
            <Eye aria-hidden />
            {s("secondary")}
          </Button>
          <Button variant="soft">
            <Share2 aria-hidden />
            {s("soft")}
          </Button>
          <Button variant="ghost">{s("ghost")}</Button>
          <Button variant="danger">
            <Trash2 aria-hidden />
            {s("danger")}
          </Button>
          <Button variant="danger-ghost">{s("danger")}</Button>
          <Button loading>{s("loadingBtn")}</Button>
          <Button disabled>{s("primary")}</Button>
          <Button size="icon" variant="secondary" aria-label={s("emptyCta")}>
            <Plus />
          </Button>
        </div>
        <Button block size="lg">
          {s("addToCart", { price: formatPrice(1500, locale) })}
        </Button>
      </Section>

      <Section id="inputs" title={t("sections.inputs")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label={s("nameLabel")} error={name ? undefined : s("nameError")}>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!name}
              aria-describedby={describedBy("name", { error: !name })}
            />
          </Field>
          <Field id="phone" label={s("phoneLabel")} hint={s("phoneHint")}>
            <PhoneInput id="phone" value={phone} onChange={setPhone} aria-describedby="phone-hint" />
          </Field>
          <Field id="search" label={s("searchPlaceholder")}>
            <Input id="search" type="search" placeholder={s("searchPlaceholder")} start={<Search className="size-5" />} />
          </Field>
          <Field id="wilaya" label={s("selectLabel")}>
            <Select id="wilaya" defaultValue="18">
              <option value="6">06 · Béjaïa</option>
              <option value="16">16 · Alger</option>
              <option value="18">18 · Jijel</option>
              <option value="19">19 · Sétif</option>
            </Select>
          </Field>
          <Field id="note" label={s("noteLabel")} className="sm:col-span-2">
            <Textarea id="note" />
          </Field>
        </div>
      </Section>

      <Section id="selection" title={t("sections.selection")}>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {chips.map((c, i) => (
            <Chip key={c} selected={chip === i} onClick={() => setChip(i)}>
              {c}
            </Chip>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col divide-y divide-line pt-2">
            <label className="flex min-h-14 items-center justify-between gap-4">
              <span>{s("visible")}</span>
              <Toggle checked={visible} onCheckedChange={setVisible} />
            </label>
            <label className="flex min-h-14 items-center justify-between gap-4">
              <span>{s("soldOut")}</span>
              <Toggle checked={soldOut} onCheckedChange={(v) => (v ? markSoldOut() : setSoldOut(false))} />
            </label>
          </CardContent>
        </Card>
        <Tabs defaultValue="a">
          <TabsList>
            {chips.map((c, i) => (
              <TabsTrigger key={c} value={String.fromCharCode(97 + i)}>
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
          {chips.map((c, i) => (
            <TabsContent key={c} value={String.fromCharCode(97 + i)}>
              <p className="text-muted">{c}</p>
            </TabsContent>
          ))}
        </Tabs>
        <Stepper steps={steps} current={2} label={ui("stepOf", { current: 3, total: steps.length })} />
      </Section>

      <Section id="feedback" title={t("sections.feedback")}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">
            <Sparkles aria-hidden />
            {s("badgeNew")}
          </Badge>
          <Badge tone="solid">
            <Star aria-hidden />
            {s("badgeBest")}
          </Badge>
          <Badge tone="danger">
            <Flame aria-hidden />
            {s("badgeSpicy")}
          </Badge>
          <Badge tone="primary">
            <CookingPot aria-hidden />
            {s("badgeDay")}
          </Badge>
          <Badge>{s("soldOut")}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="success" pulse>
            {st("open")}
          </StatusPill>
          <StatusPill tone="neutral">{st("closed")}</StatusPill>
          <StatusPill tone="info">{st("trial")}</StatusPill>
          <StatusPill tone="warning">{st("grace")}</StatusPill>
          <StatusPill tone="danger">{st("expired")}</StatusPill>
        </div>
        <div className="flex flex-col gap-2">
          {(["trial", "trial_ending", "grace", "expired", "renewal_due"] as SubscriptionBannerState[]).map((state) => (
            <SubscriptionBanner key={state} state={state} daysLeft={state === "trial" ? 9 : 2} href="#feedback" />
          ))}
        </div>
        <OfflineBanner forceVisible className="rounded-md" />
        <div>
          <Button variant="secondary" onClick={markSoldOut}>
            <Bell aria-hidden />
            {s("toastShow")}
          </Button>
        </div>
      </Section>

      <Section id="overlays" title={t("sections.overlays")}>
        <div className="flex flex-wrap gap-2">
          <BottomSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            trigger={<Button variant="secondary">{s("openSheet")}</Button>}
            title={s("sheetTitle")}
            description={s("dishDesc")}
            footer={
              <Button block size="lg" onClick={() => setSheetOpen(false)}>
                {s("addToCart", { price: formatPrice(1100, locale) })}
              </Button>
            }
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">{s("colName")}</legend>
              {[
                [s("dish"), 1100],
                [s("dish") + " XL", 1500],
              ].map(([label, price], i) => (
                <label key={i} className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-line px-3">
                  <span className="flex items-center gap-3">
                    <input type="radio" name="variant" defaultChecked={i === 0} className="size-5 accent-[var(--primary)]" />
                    {label}
                  </span>
                  <Price amount={price as number} />
                </label>
              ))}
            </fieldset>
          </BottomSheet>
          <Dialog
            trigger={<Button variant="secondary">{s("openDialog")}</Button>}
            title={s("dialogTitle")}
            footer={
              <>
                <Button variant="ghost">{ui("cancel")}</Button>
                <Button>{ui("confirm")}</Button>
              </>
            }
          >
            <p className="text-muted">{s("dialogBody")}</p>
          </Dialog>
        </div>
      </Section>

      <Section id="states" title={t("sections.states")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            icon={<UtensilsCrossed />}
            title={s("emptyTitle")}
            description={s("emptyBody")}
            action={
              <Button>
                <Plus aria-hidden />
                {s("emptyCta")}
              </Button>
            }
          />
          <ErrorState
            title={s("errorTitle")}
            description={s("errorBody")}
            action={
              <Button variant="secondary">
                <RefreshCw aria-hidden />
                {ui("retry")}
              </Button>
            }
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{ui("loading")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-16 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </Section>

      <Section id="data" title={t("sections.data")}>
        <DataTable columns={columns} data={rows} caption={s("tableCaption")} empty={s("tableEmpty")} />
        <KanbanBoard onMove={(card, col) => setKit((k) => ({ ...k, [card]: col }))}>
          {(["ordered", "mockup", "printed"] as const).map((col) => {
            const cards = rows.filter((r) => kit[r.name.split(" ").at(-1)!.toLowerCase()] === col);
            return (
              <KanbanColumn key={col} id={col} title={s(`kanban.${col}`)} count={cards.length}>
                {cards.map((r) => {
                  const id = r.name.split(" ").at(-1)!.toLowerCase();
                  return (
                    <KanbanCard key={id} id={id} column={col} dragLabel={s("move", { name: r.name })}>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-muted">{r.wilaya}</p>
                    </KanbanCard>
                  );
                })}
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
      </Section>

      <Section id="upload" title={t("sections.upload")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <UploadZone
            id="menu-upload"
            label={s("uploadLabel")}
            hint={s("uploadHint")}
            accept="image/*,application/pdf"
            multiple
            maxFiles={5}
            files={files}
            onFilesChange={setFiles}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{s("cropTitle")}</h3>
            <ImageCropper src={sampleImage} aspect={1} round onCropComplete={() => {}} />
          </div>
        </div>
      </Section>

      <Section id="brand" title={t("sections.brand")}>
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <KabyleBand />
          <p className="p-4 text-center font-semibold">{s("restaurant")}</p>
          <KabyleBand />
        </div>
      </Section>
    </div>
  );
}
