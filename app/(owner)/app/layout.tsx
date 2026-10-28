import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function OwnerRootLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return children;
}
