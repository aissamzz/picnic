// Prints a JWT secret and HS256 anon/service_role keys, like `supabase start`.
// Usage: node keys.mjs [secret]
import { createHmac, randomBytes } from "node:crypto";

const secret = process.argv[2] || randomBytes(32).toString("hex");
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${sign({ iss: "supabase-local", role: "anon", exp })}`);
console.log(`SERVICE_ROLE_KEY=${sign({ iss: "supabase-local", role: "service_role", exp })}`);
