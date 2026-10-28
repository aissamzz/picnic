import { describe, expect, it } from "vitest";
import { isScheduleActive, openState, zonedNow } from "./hours";

const TZ = "Africa/Algiers"; // UTC+1, no DST
// Wednesday 2026-10-28
const at = (hhmm: string, day = "2026-10-28") => new Date(`${day}T${hhmm}:00+01:00`);

const hours = [0, 1, 2, 3, 4, 6].map((weekday) => ({ weekday, opens: "11:00:00", closes: "23:30:00" })).concat({
  weekday: 5,
  opens: "14:00:00",
  closes: "23:30:00",
});

describe("zonedNow", () => {
  it("uses the restaurant time zone", () => {
    expect(zonedNow(TZ, new Date("2026-10-28T23:30:00Z"))).toEqual({ weekday: 4, minutes: 30, date: "2026-10-29" });
  });
});

describe("openState", () => {
  it("is open inside hours", () => expect(openState(hours, [], TZ, at("12:00"))).toMatchObject({ open: true, closesAt: "23:30" }));
  it("is closed before opening and says when it opens", () =>
    expect(openState(hours, [], TZ, at("09:00"))).toMatchObject({ open: false, opensAt: "11:00" }));
  it("handles Friday afternoon opening", () =>
    expect(openState(hours, [], TZ, at("12:00", "2026-10-30"))).toMatchObject({ open: false, opensAt: "14:00" }));
  it("honours closed exceptions", () =>
    expect(openState(hours, [{ date: "2026-10-28", closed: true, note: null }], TZ, at("12:00")).open).toBe(false));
  it("treats no hours as open", () => expect(openState([], [], TZ, at("03:00"))).toEqual({ open: true, hasHours: false }));
  it("handles slots past midnight", () => {
    const night = [{ weekday: 3, opens: "18:00:00", closes: "02:00:00" }];
    expect(openState(night, [], TZ, at("01:00", "2026-10-29")).open).toBe(true);
    expect(openState(night, [], TZ, at("03:00", "2026-10-29")).open).toBe(false);
  });
});

describe("isScheduleActive", () => {
  const breakfast = { id: "s", starts: "07:00:00", ends: "11:00:00", weekdays: [0, 1, 2, 3, 4, 5, 6] };
  it("is active within its window", () => {
    expect(isScheduleActive(breakfast, TZ, at("08:00"))).toBe(true);
    expect(isScheduleActive(breakfast, TZ, at("12:00"))).toBe(false);
  });
});
