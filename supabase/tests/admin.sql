-- Admin: two-factor required at the database, audited actions, call list, renewals.
begin;

select plan(24);

create function pg_temp.as_user(p_sub uuid, p_aal text default 'aal2') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated', 'aal', p_aal)::text, true);
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
  ('77777777-0000-4000-8000-00000000000a', '213555700101'), -- owner of Roma
  ('77777777-0000-4000-8000-00000000000d', '213555700104'); -- super admin
update public.profiles set is_super_admin = true, full_name = 'Admin' where id = '77777777-0000-4000-8000-00000000000d';
update public.profiles set full_name = 'Karim Roma' where id = '77777777-0000-4000-8000-00000000000a';
insert into public.restaurant_members (restaurant_id, user_id, role) values
  ('00000000-0000-4000-a000-000000000001', '77777777-0000-4000-8000-00000000000a', 'owner');
-- Roma: trial ending tomorrow with visits; El Bahia: paid, renewal in 10 days.
update public.restaurants set status = 'trial', trial_ends_at = now() + interval '1 day', paid_until = null where id = '00000000-0000-4000-a000-000000000001';
update public.restaurants set status = 'active', paid_until = now() + interval '10 days', plan = 'monthly' where id = '00000000-0000-4000-a000-000000000002';
insert into public.menu_events (restaurant_id, kind, session_id) select '00000000-0000-4000-a000-000000000001', 'view_table', 's' || g from generate_series(1, 5) g;

-- ---------------------------------------------------------------------------
-- Two-factor
-- ---------------------------------------------------------------------------
select pg_temp.as_user('77777777-0000-4000-8000-00000000000d', 'aal1');
set local role authenticated;
select is(public.is_super_admin(), false, 'password-only session is not admin');
select is(public.is_admin_account(), true, 'but the account is an admin account');
select is(pg_temp.err('select public.admin_overview()'), 'forbidden', 'admin RPCs need aal2');
select is((select count(*) from public.payments), 0::bigint, 'admin data stays hidden at aal1');
reset role;

select pg_temp.as_user('77777777-0000-4000-8000-00000000000a');
set local role authenticated;
select is(pg_temp.err('select public.admin_restaurants()'), 'forbidden', 'owners cannot list restaurants');
select is(pg_temp.err($$select public.admin_extend_trial('00000000-0000-4000-a000-000000000001', 30)$$), 'forbidden', 'owners cannot extend their trial');
reset role;

-- ---------------------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------------------
select pg_temp.as_user('77777777-0000-4000-8000-00000000000d');
set local role authenticated;
select ok((public.admin_overview() ->> 'trials_ending_2d')::int >= 1, 'overview counts trials ending');
select is((select owner_name || ' / ' || visits_7d from public.admin_restaurants() where id = '00000000-0000-4000-a000-000000000001'), 'Karim Roma / 5',
  'restaurant list has owner and visits');
select ok(exists (select 1 from public.admin_call_list() where id = '00000000-0000-4000-a000-000000000001' and not called_today), 'Roma is on the call list');
select ok(exists (select 1 from public.admin_renewals() where id = '00000000-0000-4000-a000-000000000002'), 'El Bahia is on the renewals list');

-- ---------------------------------------------------------------------------
-- Actions, all audited
-- ---------------------------------------------------------------------------
select lives_ok($$select public.admin_log_call('00000000-0000-4000-a000-000000000001', 'call_back', 'Rappeler demain')$$, 'call logged');
select ok((select called_today from public.admin_call_list() where id = '00000000-0000-4000-a000-000000000001'), 'call list shows it was called today');
select lives_ok($$select public.admin_add_note('00000000-0000-4000-a000-000000000001', 'Veut le kit')$$, 'note added');
select ok(public.admin_extend_trial('00000000-0000-4000-a000-000000000001', 7) > now() + interval '7 days', 'trial extended by 7 days');
select lives_ok($$select public.admin_activate_until('00000000-0000-4000-a000-000000000001', current_date + 60, 'semiannual')$$, 'manual activation');
select is((select status::text || '/' || plan::text from public.restaurant_billing where id = '00000000-0000-4000-a000-000000000001'), 'active/semiannual', 'now active');
select is(pg_temp.err($$select public.admin_set_suspended('00000000-0000-4000-a000-000000000001', true)$$), 'reason_required', 'suspension needs a reason');
select is(public.admin_set_suspended('00000000-0000-4000-a000-000000000001', true, 'Impayé'), 'suspended', 'suspended');
select is(public.admin_set_suspended('00000000-0000-4000-a000-000000000001', false), 'active', 'unsuspend returns to the computed state');

select lives_ok($$select public.admin_update_settings('{"price_monthly": 3000, "ccp_holder": "LIINKY"}')$$, 'settings updated');
select is(pg_temp.err($$select public.admin_update_settings('{"grace_days": -1}')$$), 'invalid_settings', 'settings are range-checked');
select is(pg_temp.err($$select public.admin_reserve_slug('pizzeria-roma', true)$$), 'slug_in_use', 'cannot reserve a slug in use');
select is(pg_temp.err($$insert into public.admin_notes (restaurant_id, admin_id, body) values ('00000000-0000-4000-a000-000000000001', auth.uid(), 'x')$$),
  'permission denied for table admin_notes', 'no direct writes: everything goes through audited RPCs');
select is((select count(*) from public.audit_log where action in ('admin.call', 'admin.note', 'admin.trial_extended', 'admin.activated', 'admin.suspended', 'admin.unsuspended', 'admin.settings')),
  7::bigint, 'every admin action is audited');
reset role;

select * from finish();
rollback;
