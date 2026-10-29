import type { SubscriptionBannerState } from "@/components/ui/banners";

const DAY = 24 * 3600 * 1000;

/** Which subscription banner to show on top of the owner app (null = none). */
export function bannerFor(
  r: { status: string; trial_ends_at: string; paid_until?: string | null },
  graceDays = 7,
  now = new Date(),
): { state: SubscriptionBannerState; daysLeft: number } | null {
  const left = (iso: string, plusDays = 0) => Math.max(0, Math.ceil((new Date(iso).getTime() + plusDays * DAY - now.getTime()) / DAY));
  const end = r.paid_until ?? r.trial_ends_at;
  switch (r.status) {
    case "trial": {
      const daysLeft = left(r.trial_ends_at);
      return { state: daysLeft <= 2 ? "trial_ending" : "trial", daysLeft };
    }
    case "active": {
      const daysLeft = r.paid_until ? left(r.paid_until) : 99;
      return daysLeft <= 7 ? { state: "renewal_due", daysLeft } : null;
    }
    case "grace":
      return { state: "grace", daysLeft: left(end, graceDays) };
    case "expired":
      return { state: "expired", daysLeft: 0 };
    default:
      return null;
  }
}
