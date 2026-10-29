"use client";

import { RouteError } from "@/components/ui/route-states";

export default function ErrorBoundary(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />;
}
