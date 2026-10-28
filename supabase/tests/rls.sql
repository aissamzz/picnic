-- RLS proofs. pgTAP format: runs with `supabase test db`, or locally through
-- supabase/tests/run-local.sh (which provides a tiny pgTAP subset).
-- Everything runs in a transaction and is rolled back.
begin;

select plan(31);

-- Runs a write as the current role and returns how many rows RLS let through.
create function pg_temp.affected(sql text) returns bigint language plpgsql as $f$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $f$;

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres). Restaurant A = Pizzeria Roma, B = Café El Bahia (seed).
-- ---------------------------------------------------------------------------
insert into auth.users (id, phone) values
  ('11111111-0000-4000-8000-00000000000a', '213555111111'), -- owner A
  ('11111111-0000-4000-8000-00000000000b', '213555222222'), -- staff A
  ('11111111-0000-4000-8000-00000000000c', '213555333333'), -- owner B
  ('11111111-0000-4000-8000-00000000000d', '213555444444'); -- super admin

update public.profiles set is_super_admin = true where id = '11111111-0000-4000-8000-00000000000d';

insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '11111111-0000-4000-8000-00000000000a', 'owner'),
  ('00000000-0000-4000-a000-000000000001', '11111111-0000-4000-8000-00000000000b', 'staff'),
  ('00000000-0000-4000-a000-000000000002', '11111111-0000-4000-8000-00000000000c', 'owner');

insert into public.payments (restaurant_id, method, plan, amount, reference) values
  ('00000000-0000-4000-a000-000000000001', 'baridimob', 'monthly', 2500, 'QR-TEST-A'),
  ('00000000-0000-4000-a000-000000000002', 'ccp', 'annual', 24000, 'QR-TEST-B');

insert into public.orders (restaurant_id, mode, customer_name, customer_phone, items, subtotal) values
  ('00000000-0000-4000-a000-000000000001', 'takeaway', 'Karim', '+213661000000', '[]', 800);

insert into public.slug_history (restaurant_id, old_slug) values
  ('00000000-0000-4000-a000-000000000001', 'roma-jijel');

-- ---------------------------------------------------------------------------
-- Anonymous diner
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

select throws_ok('select count(*) from public.orders', '42501', null, 'anon cannot read orders');
select throws_ok('select count(*) from public.restaurants', '42501', null, 'anon cannot read restaurants directly');
select throws_ok('select count(*) from public.payments', '42501', null, 'anon cannot read payments');
select throws_ok(
  $$insert into public.waiter_calls (restaurant_id) values ('00000000-0000-4000-a000-000000000001')$$,
  '42501', null, 'anon cannot insert waiter calls directly');

select ok(
  (public.get_public_menu('pizzeria-roma') -> 'categories') @> '[{"name":{"fr":"Pizzas"}}]',
  'anon reads the public menu through get_public_menu');
select ok(
  public.get_public_menu('pizzeria-roma')::text not like '%+213661000000%',
  'public menu never contains customer phones');
select ok(
  not (public.get_public_menu('pizzeria-roma') -> 'restaurant') ? 'paid_until',
  'public menu does not expose billing columns');
select is(
  (select redirect from public.resolve_public_slug('roma-jijel')), true,
  'old slug resolves with a redirect');
select is(public.is_slug_available('admin'), false, 'reserved slug is unavailable');
select is(public.is_slug_available('nouveau-resto'), true, 'fresh slug is available');
select is(public.is_slug_available('roma-jijel'), false, 'another restaurant''s old slug is unavailable');

reset role;

-- ---------------------------------------------------------------------------
-- Staff of A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.payments), 0::bigint, 'staff cannot read payments');
select throws_ok(
  $$insert into public.payments (restaurant_id, method, plan, amount, reference)
    values ('00000000-0000-4000-a000-000000000001', 'cash', 'monthly', 2500, 'X')$$,
  '42501', null, 'staff cannot create payments');
select is((select count(*) from public.restaurant_billing), 0::bigint, 'staff cannot read billing view');
select throws_ok('select paid_until from public.restaurants', '42501', null, 'billing columns are not selectable');
select is((select count(*) from public.restaurant_members), 1::bigint, 'staff only sees their own membership row');
select is(
  pg_temp.affected($$update public.items set base_price = 850 where id = '00000000-0000-4000-c001-000000000001'$$),
  1::bigint, 'staff can edit prices');
select is(
  pg_temp.affected($$update public.restaurants set name = 'Hacked' where id = '00000000-0000-4000-a000-000000000001'$$),
  0::bigint, 'staff cannot edit restaurant settings');
select is((select count(*) from public.orders), 1::bigint, 'staff sees their restaurant''s orders');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-4000-a000-000000000001/r.jpg')$$,
  '42501', null, 'staff cannot upload payment receipts');

reset role;

-- ---------------------------------------------------------------------------
-- Owner of A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.payments), 1::bigint, 'owner A reads only A payments');
select is((select count(*) from public.restaurant_billing), 1::bigint, 'owner A reads A billing only');
select is(
  (select count(*) from public.restaurants where id = '00000000-0000-4000-a000-000000000002'),
  0::bigint, 'restaurant A cannot read restaurant B');
select is(
  (select count(*) from public.items where restaurant_id = '00000000-0000-4000-a000-000000000002'),
  0::bigint, 'restaurant A cannot read B items');
select is(
  pg_temp.affected($$update public.items set base_price = 1 where restaurant_id = '00000000-0000-4000-a000-000000000002'$$),
  0::bigint, 'restaurant A cannot edit B items');

reset role;

-- Expired subscription locks menu editing.
update public.restaurants set status = 'expired' where id = '00000000-0000-4000-a000-000000000001';
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is(
  pg_temp.affected($$update public.items set base_price = 900 where id = '00000000-0000-4000-c001-000000000001'$$),
  0::bigint, 'expired subscription locks menu editing');
reset role;
select ok(
  (public.get_public_menu('pizzeria-roma') -> 'restaurant' ->> 'ordering_available')::boolean = false
  and jsonb_array_length(public.get_public_menu('pizzeria-roma') -> 'categories') > 0,
  'expired menu stays online with ordering disabled');
update public.restaurants set status = 'active' where id = '00000000-0000-4000-a000-000000000001';

-- ---------------------------------------------------------------------------
-- Owner of B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.orders), 0::bigint, 'restaurant B cannot read A orders');
reset role;

-- ---------------------------------------------------------------------------
-- Super admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"11111111-0000-4000-8000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.payments), 2::bigint, 'super admin reads all payments');
select is((select count(*) from public.restaurant_billing), 2::bigint, 'super admin reads all billing');
select ok((select count(*) from public.orders) >= 1, 'super admin reads orders');
reset role;

select * from finish();
rollback;
