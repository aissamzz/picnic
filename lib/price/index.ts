import type { Locale } from "@/lib/i18n/config";

/** U+202F NARROW NO-BREAK SPACE, the French thousands separator. */
export const NNBSP = " ";

type FormatOptions = {
  /** Hide the currency (Café, Gastro and Pâtisserie item rows). Totals always show it. */
  hideCurrency?: boolean;
};

/**
 * Formats an integer amount of Algerian dinars.
 * fr: `1 200 DA` (narrow no-break thousands separator, no-break space before DA)
 * ar: `1200 دج` (Western digits, no grouping)
 */
export function formatPrice(amount: number, locale: Locale, opts: FormatOptions = {}): string {
  const n = Math.round(amount);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString();
  if (locale === "ar") {
    return opts.hideCurrency ? `${sign}${abs}` : `${sign}${abs} دج`;
  }
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return opts.hideCurrency ? `${sign}${grouped}` : `${sign}${grouped} DA`;
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

function westernDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = ARABIC_INDIC.indexOf(d);
    return String(i >= 0 ? i : PERSIAN.indexOf(d));
  });
}

/**
 * Parses messy menu prices into integer DA.
 * Handles "1.100", "1100 DA", "11 00", "1 100,00 DA", "١٢٠٠ دج", "800da".
 * Returns null when no plausible price is found.
 */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null;
  let s = westernDigits(raw).toLowerCase();
  s = s.replace(/(da|dzd|دج|دينار|dinars?)/g, " ").trim();
  // Drop trailing decimal cents: "1 100,00" / "1100.00" / "450,-"
  s = s.replace(/[.,](00|-)\s*$/, "");
  // Keep only digits and separators.
  const m = s.match(/\d[\d\s.,'  ]*/);
  if (!m) return null;
  const digits = m[0].replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return value;
}
