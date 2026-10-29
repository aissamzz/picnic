import "server-only";
import { AnthropicMenuExtractor, AnthropicMenuTranslator } from "./anthropic";
import { FixtureMenuExtractor, FixtureMenuTranslator } from "./fixture";
import { AiError, type MenuExtractor, type MenuTranslator } from "./types";

export { AiError } from "./types";
export type { MenuExtractor, MenuSource, MenuTranslator, TranslationRequest } from "./types";

/**
 * AI_PROVIDER=anthropic (default) uses Claude with ANTHROPIC_API_KEY and AI_MODEL.
 * AI_PROVIDER=fixture returns canned menus (local dev, E2E). Never in production.
 */
function provider(): "anthropic" | "fixture" {
  const p = process.env.AI_PROVIDER || "anthropic";
  if (p === "fixture") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_AI_FIXTURE !== "true") throw new AiError("unavailable", "fixture provider in production");
    return "fixture";
  }
  return "anthropic";
}

export function getMenuExtractor(): MenuExtractor {
  return provider() === "fixture" ? new FixtureMenuExtractor() : new AnthropicMenuExtractor();
}

export function getMenuTranslator(): MenuTranslator {
  return provider() === "fixture" ? new FixtureMenuTranslator() : new AnthropicMenuTranslator();
}
