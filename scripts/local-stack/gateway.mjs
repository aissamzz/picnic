// Dev-only stand-in for the Supabase API gateway (Kong) + Storage.
//   /auth/v1/*    -> GoTrue
//   /rest/v1/*    -> PostgREST
//   /storage/v1/* -> files on disk (subset of the Storage API used by the app)
// Storage here does NOT enforce RLS: writes require the service_role key,
// private buckets need the service key or a signed URL. Real Supabase
// enforces supabase/migrations/*_storage.sql policies.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const AUTH = process.env.AUTH_URL ?? "http://127.0.0.1:9999";
const REST = process.env.REST_URL ?? "http://127.0.0.1:3001";
const ROOT = process.env.STORAGE_DIR;
const SECRET = process.env.JWT_SECRET;
const PUBLIC_BUCKETS = new Set((process.env.PUBLIC_BUCKETS ?? "menu-images").split(","));
if (!ROOT || !SECRET) throw new Error("STORAGE_DIR and JWT_SECRET are required");

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-upsert, prefer, range, accept-profile, content-profile, x-supabase-api-version",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  "access-control-expose-headers": "content-range, x-total-count",
};

function role(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || req.headers.apikey;
  if (!token) return null;
  const [h, p, s] = String(token).split(".");
  if (!s) return null;
  const want = createHmac("sha256", SECRET).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, "base64url");
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return JSON.parse(Buffer.from(p, "base64url").toString()).role ?? null;
}

function signToken(key, exp) {
  return createHmac("sha256", SECRET).update(`${key}:${exp}`).digest("base64url") + "." + exp;
}
function checkToken(key, token) {
  const [, exp] = String(token ?? "").split(".");
  return exp && Number(exp) > Date.now() / 1000 && token === signToken(key, exp);
}

function proxy(req, res, target, strip) {
  const url = new URL(req.url.slice(strip.length) || "/", target);
  const up = http.request(url, { method: req.method, headers: { ...req.headers, host: url.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, { ...r.headers, ...cors });
    r.pipe(res);
  });
  up.on("error", (e) => send(res, 502, { error: "upstream", message: e.message }));
  req.pipe(up);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...cors, ...headers });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Extracts the first file part of a multipart body.
function firstPart(buf, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  if (!boundary) return { data: buf, type: "application/octet-stream" };
  const sep = Buffer.from(`--${boundary[1] ?? boundary[2]}`);
  const start = buf.indexOf(sep) + sep.length + 2;
  const headEnd = buf.indexOf("\r\n\r\n", start);
  const head = buf.slice(start, headEnd).toString();
  const end = buf.indexOf(sep, headEnd) - 2;
  const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? "application/octet-stream";
  return { data: buf.slice(headEnd + 4, end), type };
}

function safe(bucket, key) {
  const p = path.join(ROOT, bucket, key);
  if (!p.startsWith(path.join(ROOT, bucket) + path.sep)) throw new Error("bad path");
  return p;
}

function serveFile(res, file) {
  if (!existsSync(file)) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
  const meta = existsSync(file + ".meta.json") ? JSON.parse(readFileSync(file + ".meta.json", "utf8")) : {};
  res.writeHead(200, { "content-type": meta.type ?? "application/octet-stream", "content-length": statSync(file).size, "cache-control": "public, max-age=60", ...cors });
  createReadStream(file).pipe(res);
}

async function storage(req, res, rest) {
  const url = new URL(rest, "http://x");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const r = role(req);
  // GET object/public/{bucket}/{key}
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "public") {
    if (!PUBLIC_BUCKETS.has(parts[2])) return send(res, 400, { message: "Bucket is not public" });
    return serveFile(res, safe(parts[2], parts.slice(3).join("/")));
  }
  // GET object/sign/{bucket}/{key}?token=
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "sign") {
    const key = parts.slice(2).join("/");
    if (!checkToken(key, url.searchParams.get("token"))) return send(res, 400, { message: "Invalid signature" });
    return serveFile(res, safe(parts[2], parts.slice(3).join("/")));
  }
  // POST object/sign/{bucket}/{key} {expiresIn}
  if (req.method === "POST" && parts[0] === "object" && parts[1] === "sign") {
    if (r !== "service_role") return send(res, 403, { message: "service_role required (dev gateway)" });
    const { expiresIn = 60 } = JSON.parse((await body(req)).toString() || "{}");
    const key = parts.slice(2).join("/");
    const exp = Math.floor(Date.now() / 1000) + Number(expiresIn);
    return send(res, 200, { signedURL: `/object/sign/${key}?token=${signToken(key, exp)}` });
  }
  // GET object/{authenticated/}{bucket}/{key}
  if (req.method === "GET" && parts[0] === "object") {
    const p = parts[1] === "authenticated" ? parts.slice(2) : parts.slice(1);
    if (r !== "service_role" && !PUBLIC_BUCKETS.has(p[0])) return send(res, 403, { message: "forbidden (dev gateway)" });
    return serveFile(res, safe(p[0], p.slice(1).join("/")));
  }
  // POST/PUT object/{bucket}/{key}
  if ((req.method === "POST" || req.method === "PUT") && parts[0] === "object") {
    if (r !== "service_role") return send(res, 403, { message: "service_role required (dev gateway)" });
    const [bucket, ...k] = parts.slice(1);
    const key = k.join("/");
    const file = safe(bucket, key);
    if (existsSync(file) && req.method === "POST" && req.headers["x-upsert"] !== "true")
      return send(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    const raw = await body(req);
    const ct = String(req.headers["content-type"] ?? "application/octet-stream");
    const { data, type } = ct.startsWith("multipart/") ? firstPart(raw, ct) : { data: raw, type: ct };
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, data);
    writeFileSync(file + ".meta.json", JSON.stringify({ type }));
    return send(res, 200, { Key: `${bucket}/${key}`, Id: key });
  }
  // DELETE object/{bucket} {prefixes}
  if (req.method === "DELETE" && parts[0] === "object") {
    if (r !== "service_role") return send(res, 403, { message: "service_role required (dev gateway)" });
    const { prefixes = [] } = JSON.parse((await body(req)).toString() || "{}");
    for (const key of prefixes) {
      const file = safe(parts[1], key);
      rmSync(file, { force: true });
      rmSync(file + ".meta.json", { force: true });
    }
    return send(res, 200, prefixes.map((name) => ({ name })));
  }
  return send(res, 404, { message: `dev gateway: unsupported storage call ${req.method} ${rest}` });
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    const u = req.url ?? "/";
    if (u.startsWith("/auth/v1")) return proxy(req, res, AUTH, "/auth/v1");
    if (u.startsWith("/rest/v1")) return proxy(req, res, REST, "/rest/v1");
    if (u.startsWith("/storage/v1")) return storage(req, res, u.slice("/storage/v1".length)).catch((e) => send(res, 500, { message: e.message }));
    if (u === "/health") return send(res, 200, { ok: true });
    send(res, 404, { message: "not found" });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`gateway on http://127.0.0.1:${PORT}`));
