import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./config";

describe("negotiateLocale", () => {
  it.each([
    ["ar-DZ,ar;q=0.9,fr;q=0.8", "ar"],
    ["fr-FR,fr;q=0.9", "fr"],
    ["en-US,en;q=0.9,fr;q=0.5", "fr"],
    ["en-US", undefined],
    [null, undefined],
  ])("%s -> %s", (header, want) => expect(negotiateLocale(header)).toBe(want));
});
