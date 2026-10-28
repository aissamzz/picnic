import { describe, expect, it } from "vitest";
import { phoneToAuthEmail } from "./phone-identity";

describe("phoneToAuthEmail", () => {
  it("maps E.164 to a stable internal email", () => {
    expect(phoneToAuthEmail("+213555123456")).toBe("p213555123456@phone.invalid");
  });
  it("rejects non-Algerian numbers", () => {
    expect(() => phoneToAuthEmail("+33612345678")).toThrow();
  });
});
