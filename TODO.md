# TODO

## Needs a decision from you
- [ ] Kit pricing: the kit is billed as kit (6 000 DA) + 12-month plan (24 000 DA) = 30 000 DA cash on delivery. Confirm, or say if the kit alone should be 6 000 DA with the plan paid separately.
- [ ] Real BaridiMob RIP / CCP details before launch (seed keeps fake values on purpose).

## Deferred
- [ ] Phase 4: `/app/equipe` to create staff invites (accept page `/invitation/[token]` exists).
- [ ] Old open code requests are only hidden after 24 h; a cleanup job can expire them (add to the nightly cron).
- [ ] Replace `lib/supabase/types.ts` with `supabase gen types` output once a Supabase stack is running.
- [ ] Document super admin bootstrap (`scripts/create-admin.mjs`) in DEPLOY.md (phase 9).
- [ ] Partition `menu_events` by month if volume requires.
- [ ] Phase 9: offline cached menu (Serwist) + offline banner on public menus.
- [ ] If the < 100 KB JS target for table mode is a hard requirement: render table mode as static HTML with a small vanilla script (see DECISIONS 39).
- [ ] Purge job: Storage objects of soft-deleted items and photos uploaded but never saved (phase 7 cron).
- [ ] Waiter-call notifications when the owner app is closed (web push, phase 9 PWA).
- [ ] Optional per-restaurant setting to accept orders while closed (pre-orders), if owners ask.
- [ ] Order statuses beyond "sent" (accepted / delivered) only if owners want to track them in the app; today WhatsApp is the source of truth.
- [ ] Confirm the production Supabase project has Realtime enabled for `waiter_calls` (the migration adds it to the `supabase_realtime` publication when that publication exists).
- [ ] AI import: run a real-menu evaluation with an API key (handwritten, Arabic-only, chalkboard, multi-page PDF) before launch; the extractor has only been exercised with the fixture provider here (no key in this environment).
- [ ] AI import: purge `imports/` sources after 30 days (phase 7 cron).
- [ ] AI import: HEIC photos are converted by iOS Safari on upload; other browsers may send HEIC, which is refused with the "files" message.
- [ ] Phase 9 DEPLOY.md: schedule `POST /api/cron/subscriptions` nightly when pg_cron is unavailable; set CRON_SECRET.
- [ ] Owner SMS/WhatsApp messages for payment approval if an SMS provider is added later (in-app notifications only for now).
- [ ] Admin MFA recovery: if the admin loses the authenticator phone, remove the factor with the service key (`auth.admin.mfa.deleteFactor`) and enroll again; document in DEPLOY.md (phase 9). Consider a second admin account.
- [ ] Restaurants list loads up to 2 000 rows and filters in the browser; switch to server-side paging past that.
