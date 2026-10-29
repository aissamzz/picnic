-- Admin-issued codes (phone verification, password reset) and onboarding RPCs.
begin;

select plan(20);

create function pg_temp.as_user(p_sub uuid, p_role text default 'authenticated') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', p_role, 'aal', 'aal2')::text, true);
end $f$;

insert into auth.users (id, phone, raw_user_meta_data) values
  ('22222222-0000-4000-8000-00000000000a', null, '{"phone":"+213555700001","full_name":"Amine"}'), -- new owner
  ('22222222-0000-4000-8000-00000000000d', null, '{"phone":"+213555700009"}');                     -- admin
update public.profiles set is_super_admin = true where id = '22222222-0000-4000-8000-00000000000d';

select is((select phone from public.profiles where id = '22222222-0000-4000-8000-00000000000a'), '+213555700001',
  'profile phone comes from signup metadata');

-- ---------------------------------------------------------------------------
-- Phone verification
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-0000-4000-8000-00000000000a');
set local role authenticated;

create temp table req as select public.request_phone_verification() as id;
grant select on req to authenticated, service_role;
select is((select status from public.get_code_request((select id from req))), 'requested'::public.code_status,
  'owner can open a verification request');
select throws_ok('select code_hash from public.phone_codes', '42501', null, 'code hashes are not readable');
select throws_ok($$select * from public.admin_issue_code((select id from req))$$, '42501', null,
  'owners cannot issue codes');
select is(public.verify_phone_code('000000'), 'no_code', 'nothing to verify before the admin issues a code');
reset role;

select pg_temp.as_user('22222222-0000-4000-8000-00000000000d');
set local role authenticated;
select is((select count(*) from public.admin_code_requests()), 1::bigint, 'admin sees the open request');
create temp table issued as select * from public.admin_issue_code((select id from req));
grant select on issued to authenticated, service_role;
select ok((select code ~ '^[0-9]{6}$' from issued), 'admin gets a 6-digit code');
select is((select seconds_left between 115 and 120 from public.get_code_request((select id from req))), true,
  'code lives two minutes');
reset role;

select pg_temp.as_user('22222222-0000-4000-8000-00000000000a');
set local role authenticated;
select is(public.verify_phone_code(case when (select code from issued) = '000000' then '000001' else '000000' end),
  'invalid', 'wrong code is rejected');
select is(public.verify_phone_code((select code from issued)), 'ok', 'right code verifies the phone');
select ok((select phone_verified_at is not null from public.profiles where id = auth.uid()), 'profile is marked verified');
select is(public.verify_phone_code((select code from issued)), 'no_code', 'a code works only once');
reset role;

-- Expiry and attempt limits.
update public.profiles set phone_verified_at = null where id = '22222222-0000-4000-8000-00000000000a';
select pg_temp.as_user('22222222-0000-4000-8000-00000000000d');
create temp table c2 as select * from public.admin_create_code('+213555700001', 'verify_phone');
grant select on c2 to authenticated, service_role;
update public.phone_codes set expires_at = now() - interval '1 second' where id = (select request_id from c2);
select pg_temp.as_user('22222222-0000-4000-8000-00000000000a');
set local role authenticated;
select is(public.verify_phone_code((select code from c2)), 'expired', 'expired code is rejected');
reset role;

select pg_temp.as_user('22222222-0000-4000-8000-00000000000d');
create temp table c3 as select * from public.admin_create_code('+213555700001', 'verify_phone');
grant select on c3 to authenticated, service_role;
select pg_temp.as_user('22222222-0000-4000-8000-00000000000a');
set local role authenticated;
select is(
  (select array_agg(public.verify_phone_code('x' || g)) from generate_series(1, 5) g),
  array['invalid', 'invalid', 'invalid', 'invalid', 'too_many'],
  'fifth wrong attempt burns the code');
select is(public.verify_phone_code((select code from c3)), 'no_code', 'burned code no longer works');
reset role;

-- ---------------------------------------------------------------------------
-- Password reset (server side, service role)
-- ---------------------------------------------------------------------------
select pg_temp.as_user(null, 'service_role');
set local role service_role;
select is(public.request_password_reset('+213555799999'), null, 'unknown phone gets no reset request');
create temp table r1 as select public.request_password_reset('+213555700001') as id;
grant select on r1 to authenticated, service_role;
reset role;
select pg_temp.as_user('22222222-0000-4000-8000-00000000000d');
create temp table r1code as select * from public.admin_issue_code((select id from r1));
grant select on r1code to authenticated, service_role;
select pg_temp.as_user(null, 'service_role');
set local role service_role;
select is((select result from public.consume_reset_code((select id from r1), (select code from r1code))), 'ok',
  'reset code is accepted once');
reset role;

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
select pg_temp.as_user('22222222-0000-4000-8000-00000000000a');
set local role authenticated;
create temp table rest as select public.create_restaurant('Chez Amine', 'chez-amine', 'grill', 18::smallint, 'Jijel', null, '+213555700001') as id;
grant select on rest to authenticated, service_role;
select is(
  (select status || '/' || template_key || '/' || (trial_ends_at > now() + interval '13 days')::text from public.restaurants where id = (select id from rest)),
  'trial/grill/true', 'new restaurant starts a 14-day trial with the matching template');
select is(public.member_role((select id from rest)), 'owner'::public.member_role, 'creator becomes owner');
select throws_ok($$select public.create_restaurant('Deux', 'deux-resto', 'cafe', 18::smallint, null, null, null)$$,
  null, null, 'one restaurant per owner');
reset role;

select * from finish();
rollback;
