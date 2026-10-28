import { describe, expect, it } from "vitest";
import { trafficSource } from "./beacon";

describe("trafficSource", () => {
  it.each([
    ["order", "ig", "instagram"],
    ["order", "TikTok", "tiktok"],
    ["order", "affiche", "poster"],
    ["order", null, "direct"],
    ["order", "weird", "direct"],
    ["table", "ig", "table"],
  ] as const)("%s ?src=%s -> %s", (mode, src, want) => expect(trafficSource(mode, src)).toBe(want));
});
