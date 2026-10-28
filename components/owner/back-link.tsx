import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-muted hover:text-ink">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {label}
    </Link>
  );
}
