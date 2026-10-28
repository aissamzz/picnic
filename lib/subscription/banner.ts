import type { SubscriptionBannerState } from "@/components/ui/banners";

const DAY = 24 * 3600 * 1000;

/**
 * Which subscription banner to show. Phase 7 adds paid_until (renewal_due)
 * and the nightly state machine; this covers the trial for now.
 */
export function bannerFor(
  r: { status: string; trial_ends_at: string },
  now = new Date(),
): { state: SubscriptionBannerState; daysLeft: number } | null {
  const daysLeft = Math.max(0, Math.ceil((new Date(r.trial_ends_at).getTime() - now.getTime()) / DAY));
  switch (r.status) {
    case "trial":
      return { state: daysLeft <= 2 ? "trial_ending" : "trial", daysLeft };
    case "grace":
      return { state: "grace", daysLeft };
    case "expired":
      return { state: "expired", daysLeft: 0 };
    default:
      return null;
  }
}
