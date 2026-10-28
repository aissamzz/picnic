# TODO

## Needs a decision from you
- [ ] Subscription prices (monthly / 6 months / annual) and kit price. Placeholders are in `platform_settings`.
- [ ] Real BaridiMob RIP, CCP number/key/holder (seed has fake values).
- [ ] SMS provider for production (interface ready in phase 2; console provider for dev).
- [ ] Final product name and domain (`APP_NAME` in `lib/config.ts`, `NEXT_PUBLIC_APP_DOMAIN`).

## Deferred
- [ ] Phase 3: public menus need their own root layout (route group with separate `<html>`), so they can be ISR-cached and skip the owner-app client bundle (sonner, full message catalog). Today the single root layout reads cookies, which makes every route dynamic.
- [ ] Phase 2: OTP voice-call fallback hook (left as TODO by spec).
- [ ] Replace `lib/supabase/types.ts` with `supabase gen types` output once a Supabase stack is running.
- [ ] Super admin bootstrap: `update public.profiles set is_super_admin = true where phone = '+213…';` (document in DEPLOY.md, phase 9).
- [ ] Partition `menu_events` by month if volume requires.
