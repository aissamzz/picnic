import type { MenuSchedule, OpeningException, OpeningHour } from "./types";

/** Weekday (0 = Sunday), minutes since midnight and ISO date in a time zone. */
export function zonedNow(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    weekday,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    date: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

type Slot = { weekday: number; opens: string; closes: string };

/** True when `minutes` on `weekday` falls inside the slot. Slots past midnight spill into the next day. */
function slotContains(s: Slot, weekday: number, minutes: number) {
  const o = toMin(s.opens);
  const c = toMin(s.closes);
  if (c > o) return s.weekday === weekday && minutes >= o && minutes < c;
  // e.g. 18:00 -> 02:00
  return (s.weekday === weekday && minutes >= o) || ((s.weekday + 1) % 7 === weekday && minutes < c);
}

export type OpenState = { open: boolean; closesAt?: string; opensAt?: string; hasHours: boolean };

export function openState(hours: OpeningHour[], exceptions: OpeningException[], timeZone: string, now = new Date()): OpenState {
  if (hours.length === 0) return { open: true, hasHours: false };
  const z = zonedNow(timeZone, now);
  if (exceptions.some((e) => e.date === z.date && e.closed)) return { open: false, hasHours: true, opensAt: nextOpening(hours, z.weekday, z.minutes) };
  const slot = hours.find((s) => slotContains(s, z.weekday, z.minutes));
  if (slot) return { open: true, hasHours: true, closesAt: slot.closes.slice(0, 5) };
  return { open: false, hasHours: true, opensAt: nextOpening(hours, z.weekday, z.minutes) };
}

/** Next opening time today or later (HH:MM), if any within a week. */
function nextOpening(hours: OpeningHour[], weekday: number, minutes: number): string | undefined {
  for (let d = 0; d < 7; d++) {
    const day = (weekday + d) % 7;
    const slots = hours
      .filter((h) => h.weekday === day)
      .map((h) => toMin(h.opens))
      .filter((o) => d > 0 || o > minutes)
      .sort((a, b) => a - b);
    if (slots.length) {
      const m = slots[0];
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    }
  }
  return undefined;
}

export function isScheduleActive(s: MenuSchedule, timeZone: string, now = new Date()): boolean {
  const z = zonedNow(timeZone, now);
  return s.weekdays.some((weekday) => slotContains({ weekday, opens: s.starts, closes: s.ends }, z.weekday, z.minutes));
}
