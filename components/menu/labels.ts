import type fr from "@/messages/fr.json";

/** Menu UI strings, passed as plain props (no i18n runtime on public menus). */
export type MenuLabels = (typeof fr)["menu"];

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
