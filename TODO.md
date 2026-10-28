# TODO

## Needs a decision from you
- [ ] Diner orders (phase 5): the spec checks a diner's first order with an SMS code. Without SMS, options: (a) no check, rely on fake-order flagging + blocked phones (current default), (b) the restaurant confirms by calling back, (c) WhatsApp itself is the check (the order arrives from the diner's own number).
- [ ] Payment approval (phase 7) said "SMS to owner": planned as an in-app notification + banner instead.
- [ ] Real BaridiMob RIP / CCP details before launch (seed keeps fake values on purpose).

## Deferred
- [ ] Phase 3: public menus need their own root layout (route group with separate `<html>`), so they can be ISR-cached and skip the owner-app client bundle (sonner, full message catalog). Today the single root layout reads cookies, which makes every route dynamic.
- [ ] Phase 8: admin MFA (TOTP) enforcement in middleware and `requireSuperAdmin()`.
- [ ] Phase 4: `/app/equipe` to create staff invites (accept page `/invitation/[token]` exists).
- [ ] Old open code requests are only hidden after 24 h; a cleanup job can expire them (phase 7 cron).
- [ ] Replace `lib/supabase/types.ts` with `supabase gen types` output once a Supabase stack is running.
- [ ] Document super admin bootstrap (`scripts/create-admin.mjs`) in DEPLOY.md (phase 9).
- [ ] Partition `menu_events` by month if volume requires.
