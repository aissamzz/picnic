# Qaima

Multi-tenant QR menu SaaS for restaurants and cafés in Algeria. Next.js 15 (App Router) + Supabase.
"Qaima" is a placeholder: rename via `APP_NAME` in `lib/config.ts` and `NEXT_PUBLIC_APP_DOMAIN`.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase URL / keys
pnpm dev
```

With the Supabase CLI and Docker: `supabase start`, then `supabase db reset` applies
`supabase/migrations` and `supabase/seed.sql`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` | Next.js dev server / production build |
| `pnpm test` | Vitest unit tests (`lib/**/*.test.ts`) |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm db:test` | Migrations + seed + RLS tests on a throwaway local Postgres (no Docker needed) |
| `pnpm db:types` | Same, then regenerates `lib/supabase/types.ts` |

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
