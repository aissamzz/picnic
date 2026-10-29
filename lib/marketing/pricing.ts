import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";

export type PublicPricing = { price_monthly: number; price_semiannual: number; price_annual: number; kit_price: number; trial_days: number };

/** Current prices (admin settings), cached 10 minutes for the marketing pages. */
export const getPublicPricing = unstable_cache(
  async (): Promise<PublicPricing | null> => {
    const { data, error } = await createAnonClient().rpc("public_pricing");
    if (error) {
      console.error("public_pricing", error);
      return null;
    }
    return data as unknown as PublicPricing;
  },
  ["public-pricing"],
  { revalidate: 600 },
);
