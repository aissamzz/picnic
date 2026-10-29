import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { EXTRACT_SYSTEM, TRANSLATE_SYSTEM } from "./prompts";
import { extractionSchema, translationSchema, type Extraction } from "./schema";
import { AiError, type MenuExtractor, type MenuSource, type MenuTranslator, type TranslationRequest } from "./types";

const DEFAULT_MODEL = "claude-opus-5-5";
// Refusals are retried on another model by the API (server-side fallback).
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

function client() {
  return new Anthropic({ timeout: 5 * 60_000, maxRetries: 2 });
}

function model() {
  return process.env.AI_MODEL || DEFAULT_MODEL;
}

function toBlock(s: MenuSource): Anthropic.Beta.BetaContentBlockParam {
  const data = s.data.toString("base64");
  return s.mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: s.mediaType, data } };
}

/** Maps API failures to codes the UI explains; logs the rest. */
function rethrow(e: unknown): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error("[ai] credentials rejected", e.status);
    throw new AiError("unavailable");
  }
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
    console.error("[ai] temporarily unavailable", e.message);
    throw new AiError("unavailable");
  }
  if (e instanceof Anthropic.BadRequestError) {
    // Usually an unreadable or oversized file.
    console.error("[ai] bad request", e.message);
    throw new AiError("unreadable");
  }
  console.error("[ai] failed", e);
  throw new AiError("failed");
}

export class AnthropicMenuExtractor implements MenuExtractor {
  async extract(sources: MenuSource[]): Promise<Extraction> {
    try {
      const message = await client()
        .beta.messages.stream({
          ...FALLBACK,
          model: model(),
          max_tokens: 64000,
          // Reading handwriting and prices is accuracy-sensitive.
          output_config: { effort: "high", format: betaZodOutputFormat(extractionSchema) },
          system: EXTRACT_SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                ...sources.map(toBlock),
                { type: "text", text: sources.length > 1 ? `These ${sources.length} files are pages of the same menu.` : "Read this menu." },
              ],
            },
          ],
        })
        .finalMessage();

      if (message.stop_reason === "refusal") throw new AiError("not_menu");
      if (message.stop_reason === "max_tokens") throw new AiError("failed", "menu too long");
      const parsed = extractionSchema.safeParse(message.parsed_output);
      if (!parsed.success) throw new AiError("failed", "invalid output");
      return parsed.data;
    } catch (e) {
      rethrow(e);
    }
  }
}

export class AnthropicMenuTranslator implements MenuTranslator {
  async translate(entries: TranslationRequest[]): Promise<Map<string, string>> {
    if (!entries.length) return new Map();
    try {
      const message = await client()
        .beta.messages.stream({
          ...FALLBACK,
          model: model(),
          max_tokens: 32000,
          output_config: { effort: "low", format: betaZodOutputFormat(translationSchema) },
          system: TRANSLATE_SYSTEM,
          messages: [
            {
              role: "user",
              content: JSON.stringify(entries.map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, text: e.text }))),
            },
          ],
        })
        .finalMessage();
      if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") throw new AiError("failed");
      const parsed = translationSchema.safeParse(message.parsed_output);
      if (!parsed.success) throw new AiError("failed", "invalid output");
      const wanted = new Set(entries.map((e) => e.id));
      return new Map(parsed.data.translations.filter((t) => wanted.has(t.id) && t.text.trim()).map((t) => [t.id, t.text.trim().slice(0, 120)]));
    } catch (e) {
      rethrow(e);
    }
  }
}
