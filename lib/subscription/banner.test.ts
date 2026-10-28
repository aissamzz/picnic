import { describe, expect, it } from "vitest";
import { bannerFor } from "./banner";

const now = new Date("2026-10-28T10:00:00Z");
describe("bannerFor", () => {
  it("counts trial days left", () => {
    expect(bannerFor({ status: "trial", trial_ends_at: "2026-11-07T10:00:00Z" }, now)).toEqual({ state: "trial", daysLeft: 10 });
  });
  it("warns in the last two days", () => {
    expect(bannerFor({ status: "trial", trial_ends_at: "2026-10-30T09:00:00Z" }, now)?.state).toBe("trial_ending");
  });
  it("hides for active subscriptions", () => {
    expect(bannerFor({ status: "active", trial_ends_at: "2026-01-01T00:00:00Z" }, now)).toBeNull();
  });
});
