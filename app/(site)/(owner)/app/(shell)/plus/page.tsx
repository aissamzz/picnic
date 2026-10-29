import { BellRing, ChevronRight, LogOut, Palette, QrCode, Shield, ShoppingBag, Store, UserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { requireRestaurant, requireSession } from "@/lib/auth/session";
import { signOut } from "@/app/(site)/(auth)/actions";

export default async function MorePage() {
  const { profile } = await requireSession();
  const restaurant = await requireRestaurant();
  const t = await getTranslations("more");
  const ta = await getTranslations("auth");
  const tl = await getTranslations("owner.plusLinks");
  const rows = [
    { href: "/app/appels", label: tl("calls"), icon: BellRing },
    { href: "/app/compte", label: t("account"), icon: UserRound },
    ...(restaurant.role === "owner"
      ? [
          { href: "/app/apparence", label: tl("appearance"), icon: Palette },
          { href: "/app/tables", label: tl("tables"), icon: QrCode },
          { href: "/app/reglages/commandes", label: tl("orders"), icon: ShoppingBag },
          { href: "/app/onboarding/1", label: t("restaurant"), icon: Store },
        ]
      : []),
    ...(profile.is_super_admin ? [{ href: "/admin", label: t("admin"), icon: Shield }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <Card className="divide-y divide-line">
        {rows.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-14 items-center gap-3 px-4 hover:bg-sand">
            <Icon className="size-5 text-muted" aria-hidden />
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight className="size-5 text-muted rtl:rotate-180" aria-hidden />
          </Link>
        ))}
      </Card>
      <form action={signOut}>
        <button type="submit" className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 font-medium text-danger hover:bg-danger-soft">
          <LogOut className="size-5" aria-hidden />
          {ta("logout")}
        </button>
      </form>
    </div>
  );
}
