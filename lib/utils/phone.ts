/** Algerian phone helpers. Storage format is E.164: +213XXXXXXXXX. */

const DZ_MOBILE = /^[567]\d{8}$/; // 05/06/07 mobiles without the leading 0
const DZ_FIXED = /^[2-4]\d{7}$/; // landlines (8 digits after the area 0)

/**
 * Normalizes "0555 12 34 56", "555123456", "+213 555 12 34 56",
 * "00213555123456" to "+213555123456". Returns null when invalid.
 */
export function normalizeDzPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+213")) d = d.slice(4);
  else if (d.startsWith("00213")) d = d.slice(5);
  else if (d.startsWith("213") && d.length >= 11) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (DZ_MOBILE.test(d) || DZ_FIXED.test(d)) return `+213${d}`;
  return null;
}

/** "+213555123456" -> "0555 12 34 56" for display. */
export function formatDzPhone(e164: string): string {
  const local = e164.startsWith("+213") ? `0${e164.slice(4)}` : e164;
  if (local.length === 10) return `${local.slice(0, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
  return local;
}

/** "+213555123456" -> "213555123456" for wa.me links. */
export function toWaNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
