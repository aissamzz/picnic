# Deploying Liinky

Target: one Docker container on [Coolify](https://coolify.io) (any Docker host works the same),
with a hosted Supabase project (or self-hosted Supabase) for Postgres, Auth, Storage and Realtime.

## 1. Supabase

1. Create a project (region closest to Algeria: `eu-central` / Frankfurt or `eu-west-3` / Paris).
2. Apply the migrations, in order, from `supabase/migrations/`:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   ```
   (or paste each file in the SQL editor, oldest first). Do **not** load `supabase/seed.sql` in production.
3. Auth settings:
   - **Disable public signups** (the server creates accounts with the service key).
   - Keep the **email** provider on. Phone numbers map to internal `p213…@phone.invalid` emails; no mail is ever sent.
   - **Multi-factor: enable TOTP** (admins must use it; `/admin` refuses password-only sessions).
4. Realtime: the ordering migration adds `public.waiter_calls` to the `supabase_realtime`
   publication when it exists. Check under Database → Publications. Without Realtime, set
   `NEXT_PUBLIC_REALTIME=off` and the live screens poll every few seconds.
5. Storage buckets (`menu-images`, `imports`, `receipts`, `kit`) are created by the storage migration.
6. Nightly jobs: if the `pg_cron` extension is enabled **before** running the billing migration,
   it schedules `subscription-tick`. The cleanup of files (old AI import sources, photos of deleted
   dishes) needs the Storage API, so schedule the HTTP endpoint below in every case.

## 2. Environment variables

| Variable | Build arg? | Value |
|---|---|---|
| `NEXT_PUBLIC_APP_DOMAIN` | yes | `liinky.app` |
| `NEXT_PUBLIC_APP_URL` | yes | `https://liinky.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | anon key |
| `NEXT_PUBLIC_REALTIME` | yes | empty, or `off` without Realtime |
| `NEXT_PUBLIC_SUPPORT_PHONE` | yes | support line for /aide, E.164 (`+213…`); empty hides the buttons |
| `SUPABASE_SERVICE_ROLE_KEY` | no | service role key (server only, never exposed) |
| `ANTHROPIC_API_KEY` | no | for AI menu import and auto-translation |
| `AI_MODEL` | no | `claude-opus-5-5` (default) |
| `AI_PROVIDER` | no | `anthropic` (`fixture` is refused in production) |
| `CRON_SECRET` | no | long random string (`openssl rand -hex 32`) |

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time: in Coolify, tick
"Build Variable" for them. The others are runtime only.

## 3. Coolify

1. New resource → Application → this Git repository, branch `main`, build pack **Dockerfile**.
2. Port **3000**. Domain `https://liinky.app` (Coolify issues the certificate).
3. Add the variables above. Deploy.
4. The image has a health check on `/connexion`.
5. If Docker Hub rate-limits the build server, set the build arg
   `NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim`.

### Scheduled task (nightly)

Coolify → the application → Scheduled Tasks → add:

- Command: `node -e "fetch('http://127.0.0.1:3000/api/cron/nightly',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(r=>r.text()).then(console.log)"`
- Frequency: `15 1 * * *` (02:15 in Algiers)

It moves subscriptions (trial → grace → expired, renewal reminders), expires stale phone
codes, purges old rate-limit rows, deletes AI import sources older than 30 days and the
photos of dishes deleted more than 30 days ago. It is idempotent; the response is a JSON
summary. Owners never wait for it: the app re-checks the subscription on each request.

## 4. First admin

From the running container (Coolify → Terminal):

```bash
node scripts/create-admin.mjs 0555123456 'a-long-password' "Your Name"
```

Then log in at `/connexion`, open `/admin`, and enrol an authenticator app (TOTP).
Set the real BaridiMob RIP and CCP details in `/admin/reglages` (the seed values are fake).

### Lost authenticator

With the service key, delete the admin's TOTP factor; they enrol again on next login:

```js
// node --env-file=.env scripts/… (one-off)
const { data } = await supabase.auth.admin.mfa.listFactors({ userId });
for (const f of data.factors) await supabase.auth.admin.mfa.deleteFactor({ userId, id: f.id });
```

## 5. After each deploy

- New migrations: `supabase db push` **before** deploying the code that needs them.
- The service worker (`/sw.js`) updates itself on the next visit (`skipWaiting`); menus already
  cached on phones refresh on their next online load.

## 6. Backups and monitoring

- Supabase daily backups (Pro plan) or `pg_dump` nightly to off-site storage.
- Uptime check on `https://liinky.app/connexion` and on one public menu.
- Container logs: errors from the cron job are prefixed `[cron]`.
