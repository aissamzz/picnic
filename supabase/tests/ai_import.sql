-- AI import: quota, source paths, applying a reviewed draft.
begin;

select plan(15);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $f$;

insert into auth.users (id, phone) values
  ('55555555-0000-4000-8000-00000000000b', '213555700002'), -- staff of Roma
  ('55555555-0000-4000-8000-00000000000c', '213555700003'); -- owner of El Bahia
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '55555555-0000-4000-8000-00000000000b', 'staff'),
  ('00000000-0000-4000-a000-000000000002', '55555555-0000-4000-8000-00000000000c', 'owner');
update public.restaurants set status = 'trial' where id = '00000000-0000-4000-a000-000000000001';
update public.platform_settings set ai_imports_per_trial = 2;

create temp table imp (id uuid);
grant all on imp to authenticated;

select pg_temp.as_user('55555555-0000-4000-8000-00000000000b');
set local role authenticated;

select is(public.ai_imports_left('00000000-0000-4000-a000-000000000001'), 2, 'trial starts with the platform quota');
select throws_ok($$select public.begin_ai_import('00000000-0000-4000-a000-000000000001', array['00000000-0000-4000-a000-000000000002/x/menu.jpg'])$$,
  '22023', null, 'sources must live under the restaurant folder');
select throws_ok($$select public.begin_ai_import('00000000-0000-4000-a000-000000000001', array[]::text[])$$,
  '22023', null, 'at least one source');
insert into imp select public.begin_ai_import('00000000-0000-4000-a000-000000000001', array['00000000-0000-4000-a000-000000000001/a/1.jpg']);
select is((select status::text from public.ai_imports where id = (select id from imp)), 'processing', 'staff opens an import');
select throws_ok($$select public.begin_ai_import('00000000-0000-4000-a000-000000000002', array['00000000-0000-4000-a000-000000000002/a/1.jpg'])$$,
  '42501', null, 'another restaurant cannot import');
reset role;

-- The extractor (service key) stores a result; one failed import does not count.
update public.ai_imports set status = 'done', result = '{"categories": []}' where id = (select id from imp);
insert into public.ai_imports (restaurant_id, source_paths, status) values ('00000000-0000-4000-a000-000000000001', '{x}', 'failed');

select pg_temp.as_user('55555555-0000-4000-8000-00000000000b');
set local role authenticated;
select is(public.ai_imports_left('00000000-0000-4000-a000-000000000001'), 1, 'failed imports are not counted');
select lives_ok($$select public.begin_ai_import('00000000-0000-4000-a000-000000000001', array['00000000-0000-4000-a000-000000000001/b/1.pdf'])$$, 'second import');
select throws_ok($$select public.begin_ai_import('00000000-0000-4000-a000-000000000001', array['00000000-0000-4000-a000-000000000001/c/1.jpg'])$$,
  'P0001', 'ai_quota', 'trial quota reached');

-- Apply: "Pizzas" exists (matched by name), "Grillades" is new.
select is(public.apply_ai_import((select id from imp), $j${"categories": [
  {"name": {"fr": "pizzas"}, "items": [
    {"name": {"fr": "Pizza Thon", "ar": "بيتزا تونة"}, "price": 900, "variants": [{"name": {"fr": "Large"}, "price": 1300}]}]},
  {"name": {"fr": "Grillades", "ar": "مشويات"}, "items": [
    {"name": {"fr": "", "ar": "شيش طاووق"}, "description": {"fr": "Poulet mariné", "ar": ""}, "price": null,
     "variants": [{"name": {"fr": "", "ar": "كبير"}, "price": 700}, {"name": {"fr": " ", "ar": ""}, "price": 1}]},
    {"name": {"fr": ""}, "price": 100}]},
  {"name": {"fr": "Vide"}, "items": []}
]}$j$::jsonb), 2, 'two items written, nameless ones skipped');
select is((select count(*) from public.categories where restaurant_id = '00000000-0000-4000-a000-000000000001' and name ->> 'fr' = 'Pizzas' and deleted_at is null), 1::bigint,
  'existing category reused (case-insensitive)');
select is((select count(*) from public.categories where restaurant_id = '00000000-0000-4000-a000-000000000001' and name ->> 'fr' in ('Grillades', 'Vide')), 1::bigint,
  'new category created, empty one skipped');
select is((select price from public.item_variants v join public.items i on i.id = v.item_id where i.name ->> 'fr' = 'Pizza Thon'), 1300, 'sizes written');
select is((select i.name::text || '|' || (select string_agg(v.name::text || v.price, ',') from public.item_variants v where v.item_id = i.id)
  from public.items i where i.name ->> 'ar' = 'شيش طاووق'), '{"ar": "شيش طاووق"}|{"ar": "كبير"}700', 'Arabic-only dish and size kept, empty strings dropped');
select throws_ok($$select public.apply_ai_import((select id from imp), '{"categories": []}')$$, 'P0002', null, 'an import is applied once');
reset role;

select pg_temp.as_user('55555555-0000-4000-8000-00000000000c');
set local role authenticated;
select is(public.ai_imports_left('00000000-0000-4000-a000-000000000001'), null, 'other restaurants see nothing');
reset role;

select * from finish();
rollback;
