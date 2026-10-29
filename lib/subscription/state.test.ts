import { describe, expect, it } from "vitest";
import { addMonths, nextStatus, paidUntilAfter, savingPercent } from "./state";

const now = new Date("2026-10-28T10:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

describe("nextStatus", () => {
  it("trial -> grace -> expired", () => {
    expect(nextStatus({ status: "trial", trial_ends_at: days(3), paid_until: null }, 7, now)).toBe("trial");
    expect(nextStatus({ status: "trial", trial_ends_at: days(-1), paid_until: null }, 7, now)).toBe("grace");
    expect(nextStatus({ status: "grace", trial_ends_at: days(-8), paid_until: null }, 7, now)).toBe("expired");
  });
  it("paid: active until paid_until, then grace, then expired", () => {
    expect(nextStatus({ status: "active", trial_ends_at: days(-100), paid_until: days(1) }, 7, now)).toBe("active");
    expect(nextStatus({ status: "active", trial_ends_at: days(-100), paid_until: days(-2) }, 7, now)).toBe("grace");
    expect(nextStatus({ status: "grace", trial_ends_at: days(-100), paid_until: days(-7) }, 7, now)).toBe("expired");
  });
  it("a payment brings an expired restaurant back", () => {
    expect(nextStatus({ status: "expired", trial_ends_at: days(-60), paid_until: days(30) }, 7, now)).toBe("active");
  });
  it("leaves admin states alone", () => {
    expect(nextStatus({ status: "suspended", trial_ends_at: days(5), paid_until: null }, 7, now)).toBe("suspended");
    expect(nextStatus({ status: "paused", trial_ends_at: days(-50), paid_until: null }, 7, now)).toBe("paused");
  });
});

describe("paid_until", () => {
  it("counts from now when expired or in trial", () => {
    expect(paidUntilAfter(null, "monthly", now).toISOString()).toBe("2026-11-28T10:00:00.000Z");
    expect(paidUntilAfter(days(-3), "semiannual", now).toISOString()).toBe("2027-04-28T10:00:00.000Z");
  });
  it("stacks on a running subscription", () => {
    expect(paidUntilAfter("2026-12-15T00:00:00Z", "annual", now).toISOString()).toBe("2027-12-15T00:00:00.000Z");
  });
  it("clamps month ends like Postgres", () => {
    expect(addMonths(new Date("2027-01-31T12:00:00Z"), 1).toISOString()).toBe("2027-02-28T12:00:00.000Z");
    expect(addMonths(new Date("2027-08-31T12:00:00Z"), 6).toISOString()).toBe("2028-02-29T12:00:00.000Z");
  });
});

describe("savingPercent", () => {
  it("matches the seeded prices", () => {
    expect(savingPercent(13_500, 2_500, "semiannual")).toBe(10);
    expect(savingPercent(24_000, 2_500, "annual")).toBe(20);
  });
});
