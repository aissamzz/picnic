# Liinky

Multi-tenant QR menu SaaS for restaurants and cafés in Algeria. Next.js 15 (App Router) + Supabase.
The name lives in one place: rename via `APP_NAME` in `lib/config.ts` and `NEXT_PUBLIC_APP_DOMAIN`.

## Setup

```bash
pnpm install
pnpm stack:start             # local Postgres + Auth + REST + Storage, writes .env.local
node --env-file=.env.local scripts/create-admin.mjs 0555000009 'admin-pass-123' "Admin"
pnpm dev
```

`pnpm stack:start` needs the Postgres binaries (no Docker). With the Supabase CLI and
Docker you can use `supabase start` + `supabase db reset` instead and copy the keys
into `.env.local` (see `.env.example`).

Hosted Supabase: apply `supabase/migrations`, then in Auth settings **disable public
signups** (accounts are created by the server) and keep the email provider enabled
(phone numbers map to internal `@phone.invalid` emails, no mail is ever sent).

### Phone verification and password reset

There is no SMS. Owners request a code from their account page (or "Mot de passe
oublié"); an admin calls them from `/admin/codes`, generates a 6-digit code and reads
it out. Codes expire after 2 minutes.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` | Next.js dev server / production build |
| `pnpm test` | Vitest unit tests (`lib/**/*.test.ts`) |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm db:test` | Migrations + seed + RLS tests on a throwaway local Postgres (no Docker needed) |
| `pnpm db:types` | Same, then regenerates `lib/supabase/types.ts` |
| `pnpm stack:start` / `stack:stop` / `stack:reset` | Local Supabase-compatible stack in `.local/` |
| `pnpm test:e2e` | Playwright against the stack + `next dev` (needs the admin above) |

Public menus: `/{slug}` (order link) and `/{slug}-menu?t={table}` (table QR). Preview any
restaurant in any template: `/apercu/{template}/{fr|ar}/{slug}`. Template display fonts are
self-hosted in `public/fonts/menu` (`node scripts/fetch-menu-fonts.mjs` re-downloads them).

`/dev/ui` shows every design-system component; switch FR/AR with the language picker
(or `?lang=ar`). Hidden in production unless `ENABLE_DEV_UI=true`.

## Layout

```
app/                      routes (marketing, auth, public menus, owner app, admin)
components/ui/            design system
lib/                      config, i18n, price, supabase clients, utils
messages/{fr,ar}.json     all UI strings
supabase/migrations       schema, RLS, public RPCs, storage
supabase/seed.sql         Pizzeria Roma (Jijel) + Café El Bahia (Béjaïa)
supabase/tests            RLS tests (pgTAP format) + local runner
```

See `DECISIONS.md` for choices made along the way and `TODO.md` for open items.
