import { describe, expect, it } from "vitest";
import { formatPrice, NNBSP, parsePrice } from ".";

describe("formatPrice", () => {
  it("formats French with narrow no-break separator", () => {
    expect(formatPrice(1200, "fr")).toBe(`1${NNBSP}200 DA`);
    expect(formatPrice(150, "fr")).toBe("150 DA");
    expect(formatPrice(1250000, "fr")).toBe(`1${NNBSP}250${NNBSP}000 DA`);
  });
  it("formats Arabic with Western digits and دج", () => {
    expect(formatPrice(1200, "ar")).toBe("1200 دج");
  });
  it("can hide currency on item rows", () => {
    expect(formatPrice(1200, "fr", { hideCurrency: true })).toBe(`1${NNBSP}200`);
  });
});

describe("parsePrice", () => {
  it.each([
    ["1.100", 1100],
    ["1100 DA", 1100],
    ["11 00", 1100],
    ["1 100,00 DA", 1100],
    ["800da", 800],
    ["١٢٠٠ دج", 1200],
    ["450", 450],
    [800, 800],
  ])("parses %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
  it.each([["", null], ["prix", null], [null, null], ["0", null]])("rejects %s", (input, expected) => {
    expect(parsePrice(input as string | null)).toBe(expected);
  });
});
