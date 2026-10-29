-- Phase 9: team invites and the hours/links settings.
begin;

select plan(18);

create function pg_temp.as_user(p_sub uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', 'aal1')::text, true);
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
  ('99999999-0000-4000-8000-00000000000a', '213555900101'), -- owner of Roma
  ('99999999-0000-4000-8000-00000000000b', '213555900102'); -- future waiter
update public.profiles set phone = '+213555900102', full_name = 'Samir' where id = '99999999-0000-4000-8000-00000000000b';
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '99999999-0000-4000-8000-00000000000a', 'owner');
update public.restaurants set status = 'trial', trial_ends_at = now() + interval '10 days' where id = '00000000-0000-4000-a000-000000000001';

create temp table t (token text);
grant all on t to authenticated;

select pg_temp.as_user('99999999-0000-4000-8000-00000000000a');
set local role authenticated;
select is(pg_temp.err($$select public.invite_staff('00000000-0000-4000-a000-000000000001', '0555')$$), 'phone_invalid', 'phone is checked');
insert into t select public.invite_staff('00000000-0000-4000-a000-000000000001', '+213555900102');
select is(length((select token from t)), 64, 'invite returns a long token');
select is(public.invite_staff('00000000-0000-4000-a000-000000000001', '+213555900102'), (select token from t), 'inviting again gives the same link');
select is((select count(*) from public.team_members('00000000-0000-4000-a000-000000000001') where status = 'pending'), 1::bigint, 'pending invite listed');
reset role;

-- The waiter opens the link and joins.
select pg_temp.as_user('99999999-0000-4000-8000-00000000000b');
set local role authenticated;
select is(public.accept_invite((select token from t)), '00000000-0000-4000-a000-000000000001'::uuid, 'invite accepted');
select is(pg_temp.err($$select public.invite_staff('00000000-0000-4000-a000-000000000001', '+213555900103')$$), 'forbidden', 'staff cannot invite');
select is((select count(*) from public.team_members('00000000-0000-4000-a000-000000000001')), 0::bigint, 'staff do not see the team list');
select is(pg_temp.err($$select public.save_hours_and_links('00000000-0000-4000-a000-000000000001', '[]', '[]', '{}')$$), 'forbidden', 'staff cannot change hours');
reset role;

select pg_temp.as_user('99999999-0000-4000-8000-00000000000a');
set local role authenticated;
select is((select full_name || ' ' || phone from public.team_members('00000000-0000-4000-a000-000000000001') where role = 'staff'), 'Samir +213555900102', 'team shows the waiter');
select is(pg_temp.err($$select public.invite_staff('00000000-0000-4000-a000-000000000001', '+213555900102')$$), 'already_member', 'cannot invite a member again');
select is(pg_temp.err($$select public.remove_member((select id from public.restaurant_members where role = 'owner' and restaurant_id = '00000000-0000-4000-a000-000000000001'))$$),
  'cannot_remove_owner', 'owner cannot be removed');
select lives_ok($$select public.remove_member((select id from public.team_members('00000000-0000-4000-a000-000000000001') where role = 'staff'))$$, 'waiter removed');

select lives_ok($$select public.save_hours_and_links('00000000-0000-4000-a000-000000000001',
  '[{"weekday": 1, "opens": "11:00", "closes": "15:00"}, {"weekday": 1, "opens": "18:00", "closes": "01:00"}]',
  '[{"date": "2026-12-31", "closed": true, "note": "Réveillon"}]',
  '{"instagram": "@roma", "maps_url": "https://maps.app.goo.gl/x"}')$$, 'hours and links saved');
select is((select count(*)::text || '/' || (select instagram from public.social_links where restaurant_id = '00000000-0000-4000-a000-000000000001')
  from public.opening_hours where restaurant_id = '00000000-0000-4000-a000-000000000001'), '2/@roma', 'replaced in one go');
reset role;

-- ---------------------------------------------------------------------------
-- Nightly maintenance
-- ---------------------------------------------------------------------------
insert into public.ai_imports (restaurant_id, source_paths, status, created_at) values
  ('00000000-0000-4000-a000-000000000001', '{r/old/1.jpg,r/old/2.jpg}', 'done', now() - interval '31 days'),
  ('00000000-0000-4000-a000-000000000001', '{r/new/1.jpg}', 'done', now() - interval '2 days');
update public.items set deleted_at = now() - interval '40 days', photos = '{r/dish.webp}'
where id = (select id from public.items where restaurant_id = '00000000-0000-4000-a000-000000000001' order by id limit 1);
insert into public.phone_codes (user_id, phone, purpose, status, code_hash, issued_at, expires_at) values
  ('99999999-0000-4000-8000-00000000000b', '+213555900102', 'reset_password', 'issued', 'x', now() - interval '10 minutes', now() - interval '8 minutes');

create temp table m as select public.run_maintenance() as r;
select is((select r -> 'import_paths' from m), '["r/old/1.jpg", "r/old/2.jpg"]'::jsonb, 'old import sources returned for deletion');
select is((select r -> 'photo_paths' from m), '["r/dish.webp"]'::jsonb, 'photos of long-deleted dishes returned');
select is((select status::text from public.phone_codes where user_id = '99999999-0000-4000-8000-00000000000b'), 'expired', 'stale codes expire');
select is((select public.run_maintenance() -> 'import_paths'), '[]'::jsonb, 'second run finds nothing (idempotent)');

select * from finish();
rollback;
