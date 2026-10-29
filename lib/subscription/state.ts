/**
 * Subscription state machine. Mirrors public.subscription_status_for() in SQL
 * (the nightly job and the per-request sync); keep both in step.
 *
 *   trial  --trial_ends_at-->  grace (grace_days)  -->  expired
 *   active --paid_until----->  grace (grace_days)  -->  expired
 *   any    --payment approved-->  active (paid_until in the future)
 *   suspended / paused are set by an admin and never change here.
 */
export type SubscriptionStatus = "trial" | "active" | "grace" | "expired" | "suspended" | "paused";
export type Plan = "monthly" | "semiannual" | "annual";

const DAY = 24 * 3600 * 1000;

export const PLAN_MONTHS: Record<Plan, number> = { monthly: 1, semiannual: 6, annual: 12 };

export function nextStatus(
  r: { status: SubscriptionStatus; trial_ends_at: string | Date; paid_until: string | Date | null },
  graceDays: number,
  now = new Date(),
): SubscriptionStatus {
  if (r.status === "suspended" || r.status === "paused") return r.status;
  const t = now.getTime();
  const grace = graceDays * DAY;
  if (r.paid_until) {
    const end = new Date(r.paid_until).getTime();
    if (t < end) return "active";
    return t < end + grace ? "grace" : "expired";
  }
  const trialEnd = new Date(r.trial_ends_at).getTime();
  if (t < trialEnd) return "trial";
  return t < trialEnd + grace ? "grace" : "expired";
}

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb), like Postgres. */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/** New paid_until after an approved payment: the plan's months from max(now, current paid_until). */
export function paidUntilAfter(current: string | Date | null, plan: Plan, now = new Date()): Date {
  const base = current && new Date(current).getTime() > now.getTime() ? new Date(current) : now;
  return addMonths(base, PLAN_MONTHS[plan]);
}

/** Price shown next to a plan relative to paying monthly (e.g. -10 %). */
export function savingPercent(price: number, monthly: number, plan: Plan): number {
  const full = monthly * PLAN_MONTHS[plan];
  return full > 0 ? Math.round((1 - price / full) * 100) : 0;
}

/** Colour of a restaurant status in lists and pills. */
export function statusTone(s: SubscriptionStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  return s === "active" ? "success" : s === "trial" ? "info" : s === "grace" ? "warning" : s === "paused" ? "neutral" : "danger";
}
