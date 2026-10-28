/**
 * Accounts are phone + password. Supabase Auth needs an email or a phone
 * identity; using its phone identity would require an SMS provider, so each
 * phone maps to a fixed internal email on the reserved `.invalid` domain
 * (RFC 2606: never routable, no mail can ever be sent). profiles.phone holds
 * the real number. Never change this mapping: it is how users sign in.
 */
export function phoneToAuthEmail(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (!/^213\d{8,9}$/.test(digits)) throw new Error("Expected an Algerian E.164 phone number");
  return `p${digits}@phone.invalid`;
}
