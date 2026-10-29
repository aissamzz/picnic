# TODO

## Needs a decision from you
- [ ] Kit pricing: the kit is billed as kit (6 000 DA) + 12-month plan (24 000 DA) = 30 000 DA cash on delivery. Confirm, or say if the kit alone should be 6 000 DA with the plan paid separately.
- [ ] Real BaridiMob RIP / CCP details before launch (seed keeps fake values on purpose).

## Deferred
- [ ] Photos uploaded in the item editor but never saved (editor closed) stay in Storage; a weekly sweep against `items.photos` could remove them.
- [ ] Owner offline queue covers sold-out and prices only; other edits need the network.
- [ ] Docker image built only as a standalone server here (Docker Hub and ECR rate-limited this environment); build it once on the Coolify server.
- [ ] Replace `lib/supabase/types.ts` with `supabase gen types` output once a Supabase stack is running.
- [ ] Partition `menu_events` by month if volume requires.
- [ ] If the < 100 KB JS target for table mode is a hard requirement: render table mode as static HTML with a small vanilla script (see DECISIONS 39).
- [ ] Waiter-call notifications when the owner app is closed: web push on top of the service worker (not built; the calls screen must be open today).
- [ ] Optional per-restaurant setting to accept orders while closed (pre-orders), if owners ask.
- [ ] Order statuses beyond "sent" (accepted / delivered) only if owners want to track them in the app; today WhatsApp is the source of truth.
- [ ] Confirm the production Supabase project has Realtime enabled for `waiter_calls` (the migration adds it to the `supabase_realtime` publication when that publication exists).
- [ ] AI import: run a real-menu evaluation with an API key (handwritten, Arabic-only, chalkboard, multi-page PDF) before launch; the extractor has only been exercised with the fixture provider here (no key in this environment).
- [ ] AI import: HEIC photos are converted by iOS Safari on upload; other browsers may send HEIC, which is refused with the "files" message.
- [ ] Owner SMS/WhatsApp messages for payment approval if an SMS provider is added later (in-app notifications only for now).
- [ ] Restaurants list loads up to 2 000 rows and filters in the browser; switch to server-side paging past that.
