-- Menu management RPCs run as the caller: RLS and the subscription lock apply.
begin;

select plan(14);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $f$;

insert into auth.users (id, phone) values
  ('33333333-0000-4000-8000-00000000000b', '213555800002'), -- staff of A (Pizzeria Roma)
  ('33333333-0000-4000-8000-00000000000c', '213555800003'); -- owner of B (Café El Bahia)
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '33333333-0000-4000-8000-00000000000b', 'staff'),
  ('00000000-0000-4000-a000-000000000002', '33333333-0000-4000-8000-00000000000c', 'owner');
insert into public.menu_events (restaurant_id, kind, source, session_id) values
  ('00000000-0000-4000-a000-000000000001', 'view_order', 'instagram', 's1'),
  ('00000000-0000-4000-a000-000000000001', 'view_order', 'instagram', 's2'),
  ('00000000-0000-4000-a000-000000000001', 'view_table', 'table', 's3');

-- ---------------------------------------------------------------------------
-- Staff of A
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-0000-4000-8000-00000000000b');
set local role authenticated;

create temp table saved as select public.save_item('00000000-0000-4000-a000-000000000001', jsonb_build_object(
  'category_id', '00000000-0000-4000-b001-000000000001',
  'name', jsonb_build_object('fr', 'Pizza Thon', 'ar', 'بيتزا تونة'),
  'base_price', 900,
  'tags', jsonb_build_array('new'),
  'variants', jsonb_build_array(jsonb_build_object('name', jsonb_build_object('fr', 'M'), 'price', 900), jsonb_build_object('name', jsonb_build_object('fr', 'L'), 'price', 1300)),
  'extras', jsonb_build_array(jsonb_build_object('name', jsonb_build_object('fr', 'Olives'), 'price', 50))
)) as id;
grant select on saved to authenticated;
select is((select count(*) from public.item_variants where item_id = (select id from saved)), 2::bigint, 'staff creates an item with its sizes');
select is((select tags from public.items where id = (select id from saved)), '{new}'::public.item_tag[], 'tags are saved');

select lives_ok($$select public.save_item('00000000-0000-4000-a000-000000000001', jsonb_build_object(
  'id', (select id from saved), 'category_id', '00000000-0000-4000-b001-000000000001',
  'name', jsonb_build_object('fr', 'Pizza Thon'), 'base_price', 950,
  'variants', jsonb_build_array(jsonb_build_object('name', jsonb_build_object('fr', 'XL'), 'price', 1600))))$$,
  'staff updates the item');
select is((select array_agg(price) from public.item_variants where item_id = (select id from saved)), array[1600],
  'sizes are replaced, not appended');
select is((select count(*) from public.item_extras where item_id = (select id from saved)), 0::bigint, 'removed extras are gone');

select is(public.bump_prices('00000000-0000-4000-a000-000000000001', -2000, '00000000-0000-4000-b001-000000000004'), 1,
  'bump touches only the chosen category');
select is((select base_price from public.items where id = '00000000-0000-4000-c001-000000000008'), 0, 'prices never go below zero');

select lives_ok($$select public.reorder_categories('00000000-0000-4000-a000-000000000001',
  array['00000000-0000-4000-b001-000000000004', '00000000-0000-4000-b001-000000000001']::uuid[])$$, 'staff reorders categories');
select is((select position from public.categories where id = '00000000-0000-4000-b001-000000000004'), 1, 'new order is stored');

select is(public.save_translations('00000000-0000-4000-a000-000000000001', jsonb_build_array(
  jsonb_build_object('kind', 'item', 'id', '00000000-0000-4000-c001-000000000005', 'field', 'name', 'fr', 'Café crème', 'ar', 'كافي كريم'))), 1,
  'staff saves translations');
select is((select sum(visits) from public.channel_stats('00000000-0000-4000-a000-000000000001')), 3::numeric, 'staff sees channel stats');
reset role;

-- ---------------------------------------------------------------------------
-- Owner of B cannot touch A
-- ---------------------------------------------------------------------------
select pg_temp.as_user('33333333-0000-4000-8000-00000000000c');
set local role authenticated;
select throws_ok($$select public.save_item('00000000-0000-4000-a000-000000000001', jsonb_build_object(
  'category_id', '00000000-0000-4000-b001-000000000001', 'name', jsonb_build_object('fr', 'Intrus')))$$,
  '42501', null, 'another restaurant cannot add items');
select is((select count(*) from public.channel_stats('00000000-0000-4000-a000-000000000001')), 0::bigint, 'another restaurant sees no stats');
reset role;

-- ---------------------------------------------------------------------------
-- Expired subscription locks the RPCs too
-- ---------------------------------------------------------------------------
update public.restaurants set status = 'expired' where id = '00000000-0000-4000-a000-000000000001';
select pg_temp.as_user('33333333-0000-4000-8000-00000000000b');
set local role authenticated;
select throws_ok($$select public.bump_prices('00000000-0000-4000-a000-000000000001', 100)$$, '42501', null, 'expired menus are locked');
reset role;

select * from finish();
rollback;
