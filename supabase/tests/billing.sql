-- Subscription state machine, payments, kit, referral, notifications.
begin;

select plan(38);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $f$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $f$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $f$;
grant execute on function pg_temp.err(text) to authenticated;

insert into auth.users (id, phone) values
  ('66666666-0000-4000-8000-00000000000a', '213555600001'), -- owner of Roma
  ('66666666-0000-4000-8000-00000000000b', '213555600002'), -- staff of Roma
  ('66666666-0000-4000-8000-00000000000c', '213555600003'), -- owner of El Bahia (referrer)
  ('66666666-0000-4000-8000-00000000000d', '213555600004'); -- super admin
update public.profiles set is_super_admin = true where id = '66666666-0000-4000-8000-00000000000d';
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '66666666-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-a000-000000000001', '66666666-0000-4000-8000-00000000000b', 'staff'),
  ('00000000-0000-4000-a000-000000000002', '66666666-0000-4000-8000-00000000000c', 'owner');
update public.platform_settings set grace_days = 7, baridimob_rip = '00799999000123456789', ccp_number = '0012345678', ccp_key = '42';
-- Roma: trial ending tomorrow, referred by El Bahia (paid until in 5 days).
update public.restaurants set status = 'trial', trial_ends_at = now() + interval '1 day', paid_until = null,
  referred_by = '00000000-0000-4000-a000-000000000002', referral_rewarded_at = null
where id = '00000000-0000-4000-a000-000000000001';
update public.restaurants set status = 'active', paid_until = now() + interval '5 days' where id = '00000000-0000-4000-a000-000000000002';

-- ---------------------------------------------------------------------------
-- State machine
-- ---------------------------------------------------------------------------
select is(public.subscription_status_for('trial', now() + interval '1 day', null, 7), 'trial', 'trial running');
select is(public.subscription_status_for('trial', now() - interval '1 day', null, 7), 'grace', 'trial over -> grace');
select is(public.subscription_status_for('grace', now() - interval '8 days', null, 7), 'expired', 'grace over -> expired');
select is(public.subscription_status_for('active', now() - interval '100 days', now() + interval '1 day', 7), 'active', 'paid -> active');
select is(public.subscription_status_for('active', now() - interval '100 days', now() - interval '2 days', 7), 'grace', 'paid_until passed -> grace');
select is(public.subscription_status_for('expired', now() - interval '100 days', now() + interval '1 month', 7), 'active', 'payment revives');
select is(public.subscription_status_for('suspended', now() + interval '5 days', null, 7), 'suspended', 'admin states stay');

-- ---------------------------------------------------------------------------
-- Request sync and reminders
-- ---------------------------------------------------------------------------
select pg_temp.as_user('66666666-0000-4000-8000-00000000000b');
set local role authenticated;
select is(public.sync_subscription('00000000-0000-4000-a000-000000000001'), 'trial', 'staff may sync');
select is(public.sync_subscription('00000000-0000-4000-a000-000000000001'), 'trial', 'sync is idempotent');
select is((select count(*) from public.notifications where restaurant_id = '00000000-0000-4000-a000-000000000001' and kind = 'trial_ending'), 1::bigint,
  'day-12 reminder posted once');
select throws_ok($$select public.sync_subscription('00000000-0000-4000-a000-000000000002')$$, '42501', null, 'cannot sync another restaurant');
select throws_ok($$select public.run_subscription_tick()$$, '42501', null, 'the tick is not callable by users');
reset role;

-- Tick moves an expired trial and a lapsed subscription.
insert into public.restaurants (id, slug, name, type, wilaya_code, status, trial_ends_at)
values ('00000000-0000-4000-a000-0000000000ee', 'old-trial', 'Old trial', 'cafe', 16, 'trial', now() - interval '3 days');
select ok(public.run_subscription_tick() >= 3, 'tick visits the movable restaurants');
select is((select status::text from public.restaurants where id = '00000000-0000-4000-a000-0000000000ee'), 'grace', 'old trial is in grace');
select is((select kind from public.notifications where restaurant_id = '00000000-0000-4000-a000-0000000000ee'), 'subscription_grace', 'grace notified');
select is((select count(*) from public.notifications where restaurant_id = '00000000-0000-4000-a000-000000000002' and kind = 'renewal_due'), 1::bigint,
  'renewal reminder 7 days before');

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
select pg_temp.as_user('66666666-0000-4000-8000-00000000000b');
set local role authenticated;
select is(pg_temp.err($$select public.submit_payment('00000000-0000-4000-a000-000000000001', 'annual', 'baridimob', '00000000-0000-4000-a000-000000000001/r.jpg')$$),
  'forbidden', 'staff cannot pay');
reset role;

select pg_temp.as_user('66666666-0000-4000-8000-00000000000a');
set local role authenticated;
select is((select ccp_key from public.payment_details()), '42', 'owners read the payment details');
select is(pg_temp.err($$select public.submit_payment('00000000-0000-4000-a000-000000000001', 'annual', 'baridimob', '00000000-0000-4000-a000-000000000002/r.jpg')$$),
  'invalid_receipt', 'receipt must be in the restaurant folder');
select is(pg_temp.err($$select public.submit_payment('00000000-0000-4000-a000-000000000001', 'annual', 'cod', '00000000-0000-4000-a000-000000000001/r.jpg')$$),
  'invalid_method', 'cash on delivery only comes with the kit');
create temp table pay as select public.submit_payment('00000000-0000-4000-a000-000000000001', 'semiannual', 'ccp', '00000000-0000-4000-a000-000000000001/r.jpg') as id;
select is((select amount from public.payments where id = (select id from pay)), 13500, 'amount comes from the settings');
select is((select reference from public.payments where id = (select id from pay)), (select payment_reference from public.restaurant_billing where id = '00000000-0000-4000-a000-000000000001'),
  'reference is the restaurant reference');
select is(pg_temp.err($$select public.submit_payment('00000000-0000-4000-a000-000000000001', 'monthly', 'ccp', '00000000-0000-4000-a000-000000000001/r2.jpg')$$),
  'pending_exists', 'one pending payment at a time');
select is(pg_temp.err($$select public.approve_payment((select id from pay))$$), 'forbidden', 'owners cannot approve');
reset role;
grant select on pay to authenticated;

select pg_temp.as_user('66666666-0000-4000-8000-00000000000d');
set local role authenticated;
create temp table approved as select public.approve_payment((select id from pay)) as paid_until;
select ok((select abs(extract(epoch from paid_until - (now() + interval '6 months'))) < 60 from approved), 'trial converted: six months from now');
select is((select status::text || '/' || plan::text from public.restaurant_billing where id = '00000000-0000-4000-a000-000000000001'), 'active/semiannual', 'restaurant active');
select is((select kind from public.notifications where restaurant_id = '00000000-0000-4000-a000-000000000001' and kind = 'payment_approved'), 'payment_approved', 'owner notified');
select ok((select paid_until = now() + interval '5 days' + interval '1 month' from public.restaurant_billing where id = '00000000-0000-4000-a000-000000000002'),
  'referrer got one free month on top of its subscription');
select is((select count(*) from public.audit_log where action in ('payment.approved', 'referral.rewarded')), 2::bigint, 'approval and reward audited');
select is(pg_temp.err($$select public.approve_payment((select id from pay))$$), 'not_pending', 'approved once');
reset role;

-- ---------------------------------------------------------------------------
-- Kit
-- ---------------------------------------------------------------------------
select pg_temp.as_user('66666666-0000-4000-8000-00000000000a');
set local role authenticated;
create temp table kit as select public.order_kit('00000000-0000-4000-a000-000000000001', 6, 2, 18::smallint, 'Jijel', 'Rue des Martyrs', '+213555600001') as id;
grant select on kit to authenticated;
select is((select cod_amount from public.kit_orders where id = (select id from kit)), 30000, 'kit + annual plan, cash on delivery');
select is(pg_temp.err($$select public.review_kit_mockup((select id from kit), true)$$), 'bad_stage', 'nothing to approve before the mockup');
reset role;

select pg_temp.as_user('66666666-0000-4000-8000-00000000000d');
set local role authenticated;
select public.kit_set_mockup((select id from kit), '00000000-0000-4000-a000-000000000001/k/mockup.pdf');
reset role;
select pg_temp.as_user('66666666-0000-4000-8000-00000000000a');
set local role authenticated;
select public.review_kit_mockup((select id from kit), false, 'Logo plus grand');
select is((select owner_feedback from public.kit_orders where id = (select id from kit)), 'Logo plus grand', 'changes requested');
reset role;
select pg_temp.as_user('66666666-0000-4000-8000-00000000000d');
set local role authenticated;
select public.kit_set_mockup((select id from kit), '00000000-0000-4000-a000-000000000001/k/mockup-2.pdf');
reset role;
select pg_temp.as_user('66666666-0000-4000-8000-00000000000a');
set local role authenticated;
select public.review_kit_mockup((select id from kit), true);
reset role;
select pg_temp.as_user('66666666-0000-4000-8000-00000000000d');
set local role authenticated;
select is(pg_temp.err($$select public.kit_advance((select id from kit), 'shipped', 'X')$$), 'bad_stage', 'stages cannot be skipped');
select public.kit_advance((select id from kit), 'printed');
select public.kit_advance((select id from kit), 'shipped', 'YAL-123');
select public.kit_advance((select id from kit), 'delivered');
select public.kit_advance((select id from kit), 'paid');
select is((select jsonb_array_length(timeline) from public.kit_orders where id = (select id from kit)), 9, 'timeline keeps every step (incl. the change request)');
select ok((select paid_until > now() + interval '17 months' from public.restaurant_billing where id = '00000000-0000-4000-a000-000000000001'),
  'COD adds a year after the running subscription');
select is((select count(*) from public.payments where restaurant_id = '00000000-0000-4000-a000-000000000001' and method = 'cod' and status = 'approved'), 1::bigint,
  'COD recorded as a payment');
reset role;

select pg_temp.as_user('66666666-0000-4000-8000-00000000000c');
set local role authenticated;
select is((select count(*) from public.my_referrals('00000000-0000-4000-a000-000000000002') where rewarded), 1::bigint, 'referrer sees the rewarded referral');
reset role;

select * from finish();
rollback;
