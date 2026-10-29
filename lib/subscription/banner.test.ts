import { describe, expect, it } from "vitest";
import { bannerFor } from "./banner";

const now = new Date("2026-10-28T10:00:00Z");
describe("bannerFor", () => {
  it("counts trial days left", () => {
    expect(bannerFor({ status: "trial", trial_ends_at: "2026-11-07T10:00:00Z" }, 7, now)).toEqual({ state: "trial", daysLeft: 10 });
  });
  it("warns in the last two days", () => {
    expect(bannerFor({ status: "trial", trial_ends_at: "2026-10-30T09:00:00Z" }, 7, now)?.state).toBe("trial_ending");
  });
  it("hides for active subscriptions until a week before renewal", () => {
    expect(bannerFor({ status: "active", trial_ends_at: "2026-01-01T00:00:00Z", paid_until: "2027-01-01T00:00:00Z" }, 7, now)).toBeNull();
    expect(bannerFor({ status: "active", trial_ends_at: "2026-01-01T00:00:00Z", paid_until: "2026-11-02T10:00:00Z" }, 7, now)).toEqual({ state: "renewal_due", daysLeft: 5 });
  });
  it("counts grace days until the lock", () => {
    expect(bannerFor({ status: "grace", trial_ends_at: "2026-10-25T10:00:00Z", paid_until: null }, 7, now)).toEqual({ state: "grace", daysLeft: 4 });
  });
});
