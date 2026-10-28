import "server-only";
import { preload } from "react-dom";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import { TemplateMenu } from "@/components/menu-templates";
import type { MenuAppProps } from "@/components/menu/menu-app";
import { wilayaLabel } from "@/lib/dz/wilayas";
import { isLocale } from "@/lib/i18n/config";
import type { Lang, PublicMenu } from "@/lib/menu/types";
import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates/meta";

/** Language for a menu: the requested one if the restaurant offers it, else its default. */
export function menuLang(requested: string, menu: PublicMenu | null): Lang {
  const r = menu?.restaurant;
  if (!r) return isLocale(requested) ? requested : "fr";
  if (isLocale(requested) && r.enabled_locales.includes(requested)) return requested;
  return r.default_locale;
}

export function RenderMenu({ templateKey, ...props }: Omit<MenuAppProps, "labels"> & { templateKey: string }) {
  const key = (TEMPLATE_KEYS as readonly string[]).includes(templateKey) ? (templateKey as TemplateKey) : "cafe";
  // Only the active template's face; Reem Kufi also covers Arabic titles.
  preload(`/fonts/menu/${key}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  if (key === "traditionnel" && props.lang === "ar") {
    preload("/fonts/menu/traditionnel-arabic.woff2", { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  const labels = (props.lang === "ar" ? ar : fr).menu;
  const r = props.menu.restaurant;
  const menu = { ...props.menu, restaurant: { ...r, wilaya_name: r.wilaya_code ? wilayaLabel(r.wilaya_code, props.lang) : null } };
  return <TemplateMenu templateKey={key} {...props} menu={menu} labels={labels} />;
}
