-- Web push: outbox triggers, one-time claim, who receives what, privacy.
begin;

select plan(11);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal1')::text, true);
end $f$;

insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '213555910101'), -- owner of Roma
  ('aaaaaaaa-0000-4000-8000-00000000000b', '213555910102'); -- waiter at Roma
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000b', 'staff');
update public.restaurants set status = 'trial', trial_ends_at = now() + interval '10 days' where id = '00000000-0000-4000-a000-000000000001';
delete from public.push_outbox;

-- Each phone subscribes through the RPC.
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000a');
set local role authenticated;
select lives_ok($$select public.save_push_subscription('00000000-0000-4000-a000-000000000001', 'https://fcm.googleapis.com/fcm/send/owner', 'p256', 'auth', 'ar', 'test')$$, 'owner subscribes');
reset role;
select pg_temp.as_user('aaaaaaaa-0000-4000-8000-00000000000b');
set local role authenticated;
select lives_ok($$select public.save_push_subscription('00000000-0000-4000-a000-000000000001', 'https://fcm.googleapis.com/fcm/send/waiter', 'p256', 'auth', 'fr', 'test')$$, 'waiter subscribes');
select is((select count(*) from public.push_subscriptions), 1::bigint, 'each person sees only their own phones');
select throws_ok($$select public.save_push_subscription('00000000-0000-4000-a000-000000000002', 'https://fcm.googleapis.com/fcm/send/x', 'p', 'a', 'fr', 't')$$, '42501', null, 'cannot subscribe to another restaurant');
select throws_ok($$select * from public.claim_push_batch(10)$$, '42501', null, 'members cannot read the outbox');
reset role;

-- A waiter call and a billing notice.
insert into public.waiter_calls (restaurant_id, table_id, kind)
select '00000000-0000-4000-a000-000000000001', id, 'bill' from public.tables where restaurant_id = '00000000-0000-4000-a000-000000000001' order by position limit 1;
select public.notify('00000000-0000-4000-a000-000000000001', 'payment_approved', '{"paid_until": "2027-01-15"}');
select is((select string_agg(kind || ':' || audience, ',' order by id) from public.push_outbox), 'waiter_call:team,notification:owners', 'calls go to the team, billing to owners');

create temp table claimed as select * from public.claim_push_batch(10);
select is((select count(*) from claimed), 2::bigint, 'both rows claimed');
select is((select count(*) from public.claim_push_batch(10)), 0::bigint, 'a second dispatcher gets nothing (sent once)');
select is((select count(*) from public.push_targets('00000000-0000-4000-a000-000000000001', 'team')), 2::bigint, 'team: owner and waiter phones');
select is((select locale from public.push_targets('00000000-0000-4000-a000-000000000001', 'owners')), 'ar', 'owners: only the owner phone, in its language');

-- Leaving the team removes the waiter's phones.
delete from public.restaurant_members where user_id = 'aaaaaaaa-0000-4000-8000-00000000000b';
select is((select count(*) from public.push_subscriptions where user_id = 'aaaaaaaa-0000-4000-8000-00000000000b'), 0::bigint, 'removed member stops receiving pushes');

select * from finish();
rollback;
