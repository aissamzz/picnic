import { MapPin, Star } from "lucide-react";
import { zonedNow } from "@/lib/menu/hours";
import type { PublicMenu } from "@/lib/menu/types";
import { cx as cn } from "@/lib/utils/cx";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "./brand-icons";
import type { MenuLabels } from "./labels";

// Algerian week starts on Saturday.
const ORDER = [6, 0, 1, 2, 3, 4, 5];

const handleUrl = (kind: "instagram" | "facebook" | "tiktok", v: string) => {
  if (/^https?:\/\//.test(v)) return v;
  const h = v.replace(/^@/, "");
  return kind === "instagram" ? `https://instagram.com/${h}` : kind === "facebook" ? `https://facebook.com/${h}` : `https://tiktok.com/@${h}`;
};

export function InfoSheetBody({ menu, labels }: { menu: PublicMenu; labels: MenuLabels }) {
  const r = menu.restaurant;
  const today = zonedNow(r.timezone).weekday;
  const address = [r.address, r.commune, r.wilaya_name].filter(Boolean).join(", ");
  const social = menu.social;
  const links = [
    social?.instagram && { href: handleUrl("instagram", social.instagram), label: "Instagram", icon: <InstagramIcon /> },
    social?.facebook && { href: handleUrl("facebook", social.facebook), label: "Facebook", icon: <FacebookIcon /> },
    social?.tiktok && { href: handleUrl("tiktok", social.tiktok), label: "TikTok", icon: <TikTokIcon /> },
    r.whatsapp_order_phone && { href: `https://wa.me/${r.whatsapp_order_phone.replace(/\D/g, "")}`, label: labels.whatsapp, icon: <WhatsAppIcon /> },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  return (
    <div className="flex flex-col gap-5">
      {address && (
        <section aria-labelledby="info-address" className="flex flex-col gap-2">
          <h3 id="info-address" className="text-sm font-semibold text-m-muted">
            {labels.address}
          </h3>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-5 shrink-0 text-m-accent" aria-hidden />
            <span>{address}</span>
          </p>
          {social?.maps_url && (
            <a href={social.maps_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center self-start rounded-full bg-m-accent px-4 text-sm font-semibold text-m-on-accent">
              {labels.directions}
            </a>
          )}
        </section>
      )}

      {menu.hours.length > 0 && (
        <section aria-labelledby="info-hours">
          <h3 id="info-hours" className="mb-2 text-sm font-semibold text-m-muted">
            {labels.hours}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {ORDER.map((d) => {
                const slots = menu.hours.filter((h) => h.weekday === d);
                return (
                  <tr key={d} className={cn("border-b border-m-line last:border-0", d === today && "font-bold")}>
                    <th scope="row" className="py-2 text-start font-[inherit]">
                      {labels.weekdays[d]}
                      {d === today && <span className="ms-2 text-xs font-semibold text-m-accent">{labels.today}</span>}
                    </th>
                    <td className="py-2 text-end">
                      {slots.length ? (
                        slots.map((s) => (
                          <bdi key={s.opens} dir="ltr" className="block tabular">
                            {s.opens.slice(0, 5)}–{s.closes.slice(0, 5)}
                          </bdi>
                        ))
                      ) : (
                        <span className="text-m-muted">{labels.closedDay}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {menu.exceptions.some((e) => e.closed) && (
            <div className="mt-3 text-sm">
              <p className="font-semibold">{labels.exceptions}</p>
              <ul className="text-m-muted">
                {menu.exceptions
                  .filter((e) => e.closed)
                  .map((e) => (
                    <li key={e.date}>
                      <bdi dir="ltr" className="tabular">
                        {e.date.split("-").reverse().join("/")}
                      </bdi>
                      {e.note && ` · ${e.note}`}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {links.length > 0 && (
        <section aria-labelledby="info-follow">
          <h3 id="info-follow" className="mb-2 text-sm font-semibold text-m-muted">
            {labels.follow}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-m-line px-4 text-sm font-semibold">
                  {l.icon}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {social?.google_review_url && (
        <a href={social.google_review_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold underline underline-offset-4">
          <Star className="size-4" aria-hidden />
          {labels.review}
        </a>
      )}
    </div>
  );
}
