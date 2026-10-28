import { describe, expect, it } from "vitest";
import { signupSchema } from "./auth";

const base = { fullName: "Amine Ben", phone: "0555 12 34 56", password: "secret123", passwordConfirm: "secret123" };

describe("signupSchema", () => {
  it("normalizes the phone", () => {
    expect(signupSchema.parse(base).phone).toBe("+213555123456");
  });
  it("requires the password twice", () => {
    const r = signupSchema.safeParse({ ...base, passwordConfirm: "secret124" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ["passwordConfirm"], message: "errors.passwordMismatch" });
  });
  it("rejects short passwords and bad phones", () => {
    const r = signupSchema.safeParse({ ...base, phone: "12", password: "short", passwordConfirm: "short" });
    expect(r.error?.issues.map((i) => i.message).sort()).toEqual(["errors.passwordTooShort", "errors.phoneInvalid"]);
  });
});
