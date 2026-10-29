import type { Extraction } from "./schema";

export type MenuSource = { mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; data: Buffer; name: string };

/** Reads menu photos or a PDF into structured data. */
export interface MenuExtractor {
  extract(sources: MenuSource[]): Promise<Extraction>;
}

export type TranslationRequest = { id: string; text: string; from: "fr" | "ar"; to: "fr" | "ar"; kind: "category" | "item" | "description" };

/** Translates menu names between French and Arabic. */
export interface MenuTranslator {
  translate(entries: TranslationRequest[]): Promise<Map<string, string>>;
}

/** Errors the UI can explain. Anything else is reported as "failed". */
export class AiError extends Error {
  constructor(
    readonly code: "unreadable" | "not_menu" | "unavailable" | "failed",
    message?: string,
  ) {
    super(message ?? code);
  }
}
