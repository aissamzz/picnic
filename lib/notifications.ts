/** Notification kind -> page it opens. All of these are billing/kit/referral: owners only. */
export const OWNER_NOTIFICATIONS: Record<string, string> = {
  trial_ending: "/app/abonnement",
  renewal_due: "/app/abonnement",
  subscription_grace: "/app/abonnement",
  subscription_expired: "/app/abonnement",
  payment_approved: "/app/abonnement",
  payment_rejected: "/app/abonnement",
  kit_mockup: "/app/kit",
  kit_printed: "/app/kit",
  kit_shipped: "/app/kit",
  kit_delivered: "/app/kit",
  referral_reward: "/app/parrainage",
};
