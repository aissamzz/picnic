-- Orders (server-priced), fake-order flagging, waiter calls, stats.
begin;

select plan(24);

create function pg_temp.as_user(p_sub uuid, p_role text default 'authenticated') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role)::text, true);
end $f$;
-- Runs an order as anon and returns the error message, or 'ok'.
create function pg_temp.try_order(p jsonb) returns text language plpgsql as $f$
begin
  perform public.submit_order('00000000-0000-4000-a000-000000000001', p);
  return 'ok';
exception when others then
  return sqlerrm;
end $f$;
grant execute on function pg_temp.try_order(jsonb) to anon;

insert into auth.users (id, phone) values
  ('44444444-0000-4000-8000-00000000000b', '213555900002'), -- staff of Roma
  ('44444444-0000-4000-8000-00000000000c', '213555900003'); -- owner of El Bahia
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '44444444-0000-4000-8000-00000000000b', 'staff'),
  ('00000000-0000-4000-a000-000000000002', '44444444-0000-4000-8000-00000000000c', 'owner');
-- Fixed snapshot of the sizes/extras ids used below.
create temp table ids as
  select (select id from public.item_variants where item_id = '00000000-0000-4000-c001-000000000002' and price = 1500) as large,
         (select id from public.item_extras where item_id = '00000000-0000-4000-c001-000000000002') as cheese,
         (select id from public.delivery_zones where name = 'Kissir') as kissir;
grant select on ids to anon, authenticated;
update public.items set is_sold_out = true where id = '00000000-0000-4000-c001-000000000006'; -- thé

create function pg_temp.base(phone text, extra jsonb default '{}') returns jsonb language sql as $f$
  select jsonb_build_object('mode', 'takeaway', 'customer_name', 'Yacine', 'customer_phone', phone, 'session_id', 'sess-' || phone, 'locale', 'fr', 'source', 'instagram') || extra
$f$;
grant execute on function pg_temp.base(text, jsonb) to anon;

-- ---------------------------------------------------------------------------
-- Anonymous diner
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

create temp table placed as select public.submit_order('00000000-0000-4000-a000-000000000001', pg_temp.base('+213661000001', jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('item_id', '00000000-0000-4000-c001-000000000002', 'variant_id', (select large from ids), 'extra_ids', jsonb_build_array((select cheese from ids)), 'qty', 2, 'unit_price', 1))))) as r;
select is((select (r ->> 'subtotal')::int from placed), 3200, 'prices come from the database, not the cart');
select is((select r -> 'items' -> 0 -> 'variant' ->> 'fr' from placed), 'Large', 'snapshot keeps the size');
select is((select r ->> 'whatsapp' from placed), '+213555000001', 'returns the restaurant WhatsApp');
select is(pg_temp.try_order(pg_temp.base('+213661000002', '{"items":[{"item_id":"00000000-0000-4000-c001-000000000006","qty":1}]}')), 'item_unavailable', 'sold out dishes cannot be ordered');
select is(pg_temp.try_order(pg_temp.base('+213661000002', '{"items":[{"item_id":"00000000-0000-4000-c001-000000000002","qty":1}]}')), 'variant_required', 'a size must be chosen');
select is(pg_temp.try_order(pg_temp.base('+213661000002', '{"items":[{"item_id":"00000000-0000-4000-c001-000000000005","qty":1}]}')), 'below_minimum', 'minimum order is enforced');
select is(pg_temp.try_order(pg_temp.base('+213661000002', '{"mode":"delivery","address":"Cité 100 logements","items":[{"item_id":"00000000-0000-4000-c001-000000000001","qty":1}]}')), 'zone_required', 'delivery needs a zone');
select is(
  (select (public.submit_order('00000000-0000-4000-a000-000000000001', pg_temp.base('+213661000002', jsonb_build_object('mode', 'delivery', 'address', 'Cité 100 logements', 'zone_id', (select kissir from ids),
     'items', '[{"item_id":"00000000-0000-4000-c001-000000000001","qty":1}]'::jsonb))) ->> 'total')::int),
  1050, 'delivery fee comes from the zone');
select is(pg_temp.try_order(pg_temp.base('0661', '{"items":[{"item_id":"00000000-0000-4000-c001-000000000001","qty":1}]}')), 'invalid_phone', 'phone must be E.164');
select is(
  (select array_agg(pg_temp.try_order(pg_temp.base('+213661000003', '{"items":[{"item_id":"00000000-0000-4000-c001-000000000001","qty":1}]}'))) from generate_series(1, 6)),
  array['ok', 'ok', 'ok', 'ok', 'ok', 'rate_limited'], 'orders are rate limited per phone');
select throws_ok($$select public.submit_order('00000000-0000-4000-a000-000000000002', pg_temp.base('+213661000004', '{"items":[]}'))$$,
  null, null, 'restaurants without ordering refuse orders');
select throws_ok('select count(*) from public.orders', '42501', null, 'anon still cannot read orders');
reset role;

-- ---------------------------------------------------------------------------
-- Flagging: staff of Roma flags two orders of the same phone -> blocked
-- ---------------------------------------------------------------------------
select pg_temp.as_user('44444444-0000-4000-8000-00000000000c');
set local role authenticated;
select throws_ok($$select public.flag_order((select id from public.orders where customer_phone = '+213661000003' limit 1), true)$$,
  '42501', null, 'another restaurant cannot flag');
select is(public.restaurant_stats('00000000-0000-4000-a000-000000000001'), null, 'another restaurant gets no stats');
reset role;

select pg_temp.as_user('44444444-0000-4000-8000-00000000000b');
set local role authenticated;
create temp table o3 as select id from public.orders where customer_phone = '+213661000003' order by created_at limit 2;
grant select on o3 to authenticated, anon;
select is(public.flag_order((select id from o3 order by id limit 1), true), 'flagged_fake', 'staff flags a fake order');
select is(public.flag_order((select id from o3 order by id desc limit 1), true), 'flagged_fake', 'second report');
select is((select (public.restaurant_stats('00000000-0000-4000-a000-000000000001') -> 'orders' ->> 'flagged')::int), 2, 'stats count flagged orders');
reset role;
select ok((select blocked_at is not null from public.blocked_phones where phone = '+213661000003'), 'two reports block the phone platform-wide');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(pg_temp.try_order(pg_temp.base('+213661000003', '{"session_id":"another-session","items":[{"item_id":"00000000-0000-4000-c001-000000000001","qty":1}]}')), 'phone_blocked', 'blocked phones cannot order');

-- ---------------------------------------------------------------------------
-- Waiter calls
-- ---------------------------------------------------------------------------
select is((public.call_waiter('00000000-0000-4000-a000-000000000001', 't3', 'waiter', 'table-session-1') ->> 'status'), 'sent', 'a table calls the waiter');
select is((public.call_waiter('00000000-0000-4000-a000-000000000001', 'T3', 'waiter', 'table-session-1') ->> 'status'), 'cooldown', 'same call again waits for the cooldown');
select is((public.call_waiter('00000000-0000-4000-a000-000000000001', 'T3', 'bill', 'table-session-1') ->> 'status'), 'sent', 'another kind of call goes through');
select throws_ok($$select public.call_waiter('00000000-0000-4000-a000-000000000001', 'T99', 'waiter', 'table-session-1')$$, null, null, 'unknown tables are refused');
reset role;

select pg_temp.as_user('44444444-0000-4000-8000-00000000000b');
set local role authenticated;
select is(public.handle_waiter_call((select id from public.waiter_calls where kind = 'waiter' and status = 'open' limit 1)), true, 'staff handles the call');
reset role;

select * from finish();
rollback;
