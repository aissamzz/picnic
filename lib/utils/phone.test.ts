import { describe, expect, it } from "vitest";
import { formatDzPhone, normalizeDzPhone } from "./phone";

describe("normalizeDzPhone", () => {
  it.each([
    ["0555 12 34 56", "+213555123456"],
    ["555123456", "+213555123456"],
    ["+213 555 12 34 56", "+213555123456"],
    ["00213661234567", "+213661234567"],
    ["0771-23-45-67", "+213771234567"],
    ["034 12 34 56", "+21334123456"],
  ])("%s -> %s", (input, out) => expect(normalizeDzPhone(input)).toBe(out));
  it.each(["12345", "0855123456", "+33612345678", ""])("rejects %s", (input) =>
    expect(normalizeDzPhone(input)).toBeNull(),
  );
  it("formats for display", () => expect(formatDzPhone("+213555123456")).toBe("0555 12 34 56"));
});
