import { Bell } from "lucide-react";
import Link from "next/link";

/** Header bell with the unread count (server-rendered on each navigation). */
export function NotificationsBell({ count, label }: { count: number; label: string }) {
  return (
    <Link href="/app/notifications" aria-label={label} className="relative grid size-11 place-items-center rounded-full hover:bg-ink/5">
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute end-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white tabular" aria-hidden>
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
