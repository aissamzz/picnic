import { MessageCircle, Phone } from "lucide-react";
import { formatDzPhone } from "@/lib/utils/phone";

/** tel: and wa.me links for an owner phone (stored as +213XXXXXXXXX). */
export function ContactButtons({ phone, callLabel }: { phone: string | null; callLabel: string }) {
  if (!phone) return <span className="text-muted">–</span>;
  const e164 = `+${phone.replace(/^\+/, "")}`;
  return (
    <span className="flex items-center gap-2">
      <a href={`tel:${e164}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-white">
        <Phone className="size-4" aria-hidden />
        {callLabel}
      </a>
      <a href={`https://wa.me/${e164.slice(1)}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="grid size-9 place-items-center rounded-full border border-line">
        <MessageCircle className="size-4" aria-hidden />
      </a>
      <bdi dir="ltr" className="text-sm text-muted tabular">
        {formatDzPhone(e164)}
      </bdi>
    </span>
  );
}
