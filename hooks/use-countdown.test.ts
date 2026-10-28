import { describe, expect, it } from "vitest";
import { formatMMSS } from "./use-countdown";

describe("formatMMSS", () => {
  it.each([
    [120, "2:00"],
    [65, "1:05"],
    [9, "0:09"],
    [0, "0:00"],
  ])("%i -> %s", (s, out) => expect(formatMMSS(s)).toBe(out));
});
