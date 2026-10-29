"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { countItems, toApplyPayload, toDraft, type ImportDraft } from "@/lib/ai/draft";
import { AiError, getMenuExtractor, getMenuTranslator, type MenuSource } from "@/lib/ai";
import { fail, type ActionResult } from "@/lib/actions/result";
import { requireRestaurant } from "@/lib/auth/session";
import { revalidateMenu } from "@/lib/menu/revalidate";
import { rateLimit } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const BUCKET = "imports";

/** Error codes shown by the uploader (messages under import.errors). */
export type ImportError = "files" | "quota" | "rate_limited" | "locked" | "unreadable" | "not_menu" | "unavailable" | "failed";

async function toSources(files: File[]): Promise<MenuSource[] | null> {
  const pdfs = files.filter((f) => f.type === "application/pdf");
  const images = files.filter((f) => IMAGE_TYPES.has(f.type));
  const valid =
    files.length > 0 &&
    pdfs.length + images.length === files.length &&
    ((pdfs.length === 1 && images.length === 0 && pdfs[0].size <= MAX_PDF_BYTES) ||
      (pdfs.length === 0 && images.length <= MAX_IMAGES && images.every((f) => f.size <= MAX_IMAGE_BYTES)));
  if (!valid) return null;
  if (pdfs.length) return [{ mediaType: "application/pdf", data: Buffer.from(await pdfs[0].arrayBuffer()), name: pdfs[0].name }];
  try {
    return await Promise.all(
      images.map(async (f) => ({
        mediaType: "image/jpeg" as const,
        // Upright, at most 2000 px: enough to read small print, fewer tokens.
        data: await sharp(Buffer.from(await f.arrayBuffer()), { failOn: "error" })
          .rotate()
          .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer(),
        name: f.name,
      })),
    );
  } catch {
    return null;
  }
}

/**
 * Uploads the photos (up to 5) or one PDF, reads them with the MenuExtractor
 * and stores the draft on ai_imports. Waits for the result (30-90 s).
 */
export async function startImport(form: FormData): Promise<ActionResult<{ importId: string; items: number }>> {
  const r = await requireRestaurant();
  const sources = await toSources(form.getAll("files").filter((f): f is File => f instanceof File));
  if (!sources) return fail("files" satisfies ImportError);

  // Sources are kept privately for support and retries.
  const service = createServiceClient();
  const folder = `${r.id}/${randomUUID()}`;
  const paths = sources.map((s, i) => `${folder}/${i + 1}.${s.mediaType === "application/pdf" ? "pdf" : "jpg"}`);
  for (const [i, s] of sources.entries()) {
    const { error } = await service.storage.from(BUCKET).upload(paths[i], s.data, { contentType: s.mediaType });
    if (error) return fail("failed" satisfies ImportError);
  }

  const supabase = await createClient();
  const { data: importId, error } = await supabase.rpc("begin_ai_import", { p_restaurant_id: r.id, p_paths: paths });
  if (error || !importId) {
    await service.storage.from(BUCKET).remove(paths);
    const code: ImportError = error?.message === "ai_quota" ? "quota" : error?.message === "rate_limited" ? "rate_limited" : error?.code === "42501" ? "locked" : "failed";
    return fail(code);
  }

  try {
    const draft = toDraft(await getMenuExtractor().extract(sources));
    if (countItems(draft) === 0) throw new AiError("unreadable");
    await service.from("ai_imports").update({ status: "done", result: draft }).eq("id", importId);
    return { ok: true, data: { importId, items: countItems(draft) } };
  } catch (e) {
    const code: ImportError = e instanceof AiError ? e.code : "failed";
    if (!(e instanceof AiError)) console.error("[ai-import]", e);
    await service.from("ai_imports").update({ status: "failed", error: code }).eq("id", importId);
    return fail(code);
  }
}

const text = z.string().trim().max(120);
const i18n = z.object({ fr: text, ar: text });
const price = z.number().int().min(0).max(1_000_000).nullable();
const draftSchema = z.object({
  partial: z.boolean(),
  categories: z
    .array(
      z.object({
        key: z.string(),
        name: i18n,
        items: z
          .array(
            z.object({
              key: z.string(),
              name: i18n,
              description: i18n,
              price,
              variants: z.array(z.object({ name: i18n, price })).max(10),
              check: z.object({ name: z.boolean(), price: z.boolean() }),
            }),
          )
          .max(200),
      }),
    )
    .max(40),
});

/** Writes the reviewed draft into the menu. Returns the number of dishes added. */
export async function applyImport(importId: string, draft: ImportDraft): Promise<ActionResult<{ items: number }>> {
  const r = await requireRestaurant();
  const id = z.guid().safeParse(importId);
  const parsed = draftSchema.safeParse(draft);
  if (!id.success || !parsed.success) return fail("errors.generic");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_ai_import", { p_import_id: id.data, p_draft: toApplyPayload(parsed.data) });
  if (error) return fail(error.code === "42501" ? "errors.locked" : error.code === "P0002" ? "import.errors.applied" : "errors.generic");
  revalidateMenu(r.slug);
  return { ok: true, data: { items: data ?? 0 } };
}

const translateSchema = z
  .array(z.object({ id: z.string().max(80), text: z.string().trim().min(1).max(200), from: z.enum(["fr", "ar"]), to: z.enum(["fr", "ar"]), kind: z.enum(["category", "item", "description"]) }))
  .min(1)
  .max(300);

/** Suggests translations for missing names; the owner reviews them before saving. */
export async function suggestTranslations(entries: z.input<typeof translateSchema>): Promise<ActionResult<{ translations: Record<string, string> }>> {
  const r = await requireRestaurant();
  const parsed = translateSchema.safeParse(entries);
  if (!parsed.success) return fail("errors.generic");
  if (!(await rateLimit(`ai-translate:${r.id}`, 20, 3600))) return fail("import.errors.rate_limited");
  try {
    const map = await getMenuTranslator().translate(parsed.data.filter((e) => e.from !== e.to));
    return { ok: true, data: { translations: Object.fromEntries(map) } };
  } catch (e) {
    return fail(e instanceof AiError && e.code === "unavailable" ? "import.errors.unavailable" : "import.errors.translateFailed");
  }
}
