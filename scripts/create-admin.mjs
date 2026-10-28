#!/usr/bin/env node
// Creates (or promotes) a super admin with phone + password.
//   node --env-file=.env.local scripts/create-admin.mjs 0555123456 'password' "Full Name"
// Works against local and hosted Supabase (needs SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from "@supabase/supabase-js";

const [rawPhone, password, fullName = "Admin"] = process.argv.slice(2);
if (!rawPhone || !password) {
  console.error("usage: create-admin.mjs <phone> <password> [full name]");
  process.exit(1);
}
let d = rawPhone.replace(/[^\d]/g, "");
if (d.startsWith("00213")) d = d.slice(5);
else if (d.startsWith("213")) d = d.slice(3);
if (d.startsWith("0")) d = d.slice(1);
if (!/^[5-7]\d{8}$/.test(d)) throw new Error("Expected an Algerian mobile number");
const phone = `+213${d}`;
const email = `p213${d}@phone.invalid`; // must match lib/auth/phone-identity.ts

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: existing } = await supabase.from("profiles").select("id").eq("phone", phone).maybeSingle();
let id = existing?.id;
if (!id) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { phone, full_name: fullName },
  });
  if (error) throw error;
  id = data.user.id;
} else {
  const { error } = await supabase.auth.admin.updateUserById(id, { password });
  if (error) throw error;
}
const { error } = await supabase
  .from("profiles")
  .update({ is_super_admin: true, phone_verified_at: new Date().toISOString() })
  .eq("id", id);
if (error) throw error;
console.log(`super admin ready: ${phone}`);
