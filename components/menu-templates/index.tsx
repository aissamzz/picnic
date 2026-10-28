"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { MenuAppProps } from "@/components/menu/menu-app";
import type { TemplateKey } from "@/lib/templates/meta";

/**
 * Lazy client entry per template. Chosen on the client side on purpose: a
 * server-side import of all nine would put every template in the page's
 * chunks. Here a diner only downloads the rendered template (still SSR'd).
 */
const TEMPLATE_MENUS: Record<TemplateKey, ComponentType<MenuAppProps>> = {
  pizzeria: dynamic(() => import("./pizzeria")),
  cafe: dynamic(() => import("./cafe")),
  traditionnel: dynamic(() => import("./traditionnel")),
  gastro: dynamic(() => import("./gastro")),
  patisserie: dynamic(() => import("./patisserie")),
  grill: dynamic(() => import("./grill")),
  jus: dynamic(() => import("./jus")),
  mer: dynamic(() => import("./mer")),
  coffee: dynamic(() => import("./coffee")),
};

export function TemplateMenu({ templateKey, ...props }: MenuAppProps & { templateKey: TemplateKey }) {
  const Template = TEMPLATE_MENUS[templateKey];
  return <Template {...props} />;
}
