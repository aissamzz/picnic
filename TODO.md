# TODO

## Needs a decision from you
- [ ] Payment approval (phase 7) said "SMS to owner": planned as an in-app notification + banner instead.
- [ ] Real BaridiMob RIP / CCP details before launch (seed keeps fake values on purpose).

## Deferred
- [ ] Phase 8: admin MFA (TOTP) enforcement in middleware and `requireSuperAdmin()`.
- [ ] Phase 4: `/app/equipe` to create staff invites (accept page `/invitation/[token]` exists).
- [ ] Old open code requests are only hidden after 24 h; a cleanup job can expire them (phase 7 cron).
- [ ] Replace `lib/supabase/types.ts` with `supabase gen types` output once a Supabase stack is running.
- [ ] Document super admin bootstrap (`scripts/create-admin.mjs`) in DEPLOY.md (phase 9).
- [ ] Partition `menu_events` by month if volume requires.
- [ ] Phase 5: cart + checkout on order links, waiter-call button on table links.
- [ ] Phase 9: offline cached menu (Serwist) + offline banner on public menus.
- [ ] If the < 100 KB JS target for table mode is a hard requirement: render table mode as static HTML with a small vanilla script (see DECISIONS 39).
- [ ] Purge job: Storage objects of soft-deleted items and photos uploaded but never saved (phase 7 cron).
- [ ] Phase 6: "Traduire automatiquement" button on the translations screen.
