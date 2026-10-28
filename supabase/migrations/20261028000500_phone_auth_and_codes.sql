-- Phone + password accounts, no SMS anywhere.
--
-- * Accounts are created server-side (service role) with phone + password.
--   Supabase Auth stores them under an internal email derived from the phone
--   (see lib/auth/phone-identity.ts); profiles.phone is the real identity.
-- * Phone verification and password reset use one-time codes that an admin
--   generates while on the phone with the owner. A code lives 2 minutes and
--   allows 5 attempts.

-- ---------------------------------------------------------------------------
-- Settings: drop SMS knobs, add code knobs. No SMS means no first-order OTP
-- by default (phase 5 decides how diners are checked).
-- ---------------------------------------------------------------------------
alter table public.platform_settings
  drop column sms_provider,
  drop column otp_max_per_hour,
  add column code_ttl_seconds int not null default 120 check (code_ttl_seconds between 30 and 1800),
  add column code_max_attempts int not null default 5 check (code_max_attempts between 1 and 20),
  add column code_requests_per_hour int not null default 5 check (code_requests_per_hour between 1 and 100),
  alter column first_order_otp set default false;
update public.platform_settings set first_order_otp = false;

-- 58 wilayas (2019 division).
alter table public.restaurants drop constraint restaurants_wilaya_code_check,
  add constraint restaurants_wilaya_code_check check (wilaya_code between 1 and 58);
alter table public.kit_orders drop constraint kit_orders_wilaya_code_check,
  add constraint kit_orders_wilaya_code_check check (wilaya_code between 1 and 58);

-- ---------------------------------------------------------------------------
-- Profiles: one account per phone, verification timestamp.
-- ---------------------------------------------------------------------------
alter table public.profiles add column phone_verified_at timestamptz;
create unique index profiles_phone_key on public.profiles (phone) where phone is not null;

grant select (phone_verified_at) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text := coalesce(nullif(new.phone, ''), new.raw_user_meta_data ->> 'phone');
begin
  insert into public.profiles (id, phone, full_name, locale)
  values (
    new.id,
    case when v_phone is null or v_phone = '' then null
         when left(v_phone, 1) = '+' then v_phone else '+' || v_phone end,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fr')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- One-time codes issued by an admin
-- ---------------------------------------------------------------------------
create type public.code_purpose as enum ('verify_phone', 'reset_password');
create type public.code_status as enum ('requested', 'issued', 'used', 'expired', 'cancelled');

create table public.phone_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  purpose public.code_purpose not null,
  status public.code_status not null default 'requested',
  code_hash text,
  attempts int not null default 0,
  requested_by_admin boolean not null default false,
  requested_at timestamptz not null default now(),
  issued_at timestamptz,
  expires_at timestamptz,
  issued_by uuid references auth.users (id),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index phone_codes_open_idx on public.phone_codes (requested_at desc) where status in ('requested', 'issued');
create index phone_codes_user_idx on public.phone_codes (user_id, purpose, requested_at desc);
create trigger set_updated_at before update on public.phone_codes
  for each row execute function public.set_updated_at();

alter table public.phone_codes enable row level security;
grant all on public.phone_codes to service_role;
-- code_hash is never readable by clients.
grant select (id, user_id, phone, purpose, status, attempts, requested_by_admin, requested_at, issued_at, expires_at, used_at)
  on public.phone_codes to authenticated;
create policy phone_codes_select on public.phone_codes for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

create or replace function public.code_hash(p_request_id uuid, p_code text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_request_id::text || ':' || p_code, 'UTF8')), 'hex')
$$;

-- 6 random digits from a CSPRNG-backed uuid.
create or replace function public.random_digits6()
returns text language sql volatile as $$
  select lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0')
$$;

-- Effective status: an issued code past its expiry reads as expired.
create or replace function public.code_effective_status(c public.phone_codes)
returns public.code_status language sql stable as $$
  select case when c.status = 'issued' and c.expires_at <= now() then 'expired'::public.code_status else c.status end
$$;

create or replace function public.open_code_request(p_user_id uuid, p_purpose public.code_purpose, p_by_admin boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_phone text;
  v_id uuid;
begin
  select phone into v_phone from public.profiles where id = p_user_id;
  if v_phone is null then
    raise exception 'no_phone';
  end if;
  update public.phone_codes set status = 'cancelled'
  where user_id = p_user_id and purpose = p_purpose and status in ('requested', 'issued');
  insert into public.phone_codes (user_id, phone, purpose, requested_by_admin)
  values (p_user_id, v_phone, p_purpose, p_by_admin)
  returning id into v_id;
  return v_id;
end $$;

-- Owner taps "Vérifier mon numéro".
create or replace function public.request_phone_verification()
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_limit int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = v_uid and phone_verified_at is not null) then
    raise exception 'already_verified';
  end if;
  select code_requests_per_hour into v_limit from public.platform_settings;
  if not public.hit_rate_limit('code:' || v_uid, v_limit, 3600) then
    raise exception 'rate_limited';
  end if;
  return public.open_code_request(v_uid, 'verify_phone', false);
end $$;

-- "Mot de passe oublié": anonymous, so only the server (service role) calls it.
-- Returns null when no account has this phone.
create or replace function public.request_password_reset(p_phone text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_limit int;
begin
  select id into v_uid from public.profiles where phone = p_phone;
  if v_uid is null then return null; end if;
  select code_requests_per_hour into v_limit from public.platform_settings;
  if not public.hit_rate_limit('reset:' || p_phone, v_limit, 3600) then
    raise exception 'rate_limited';
  end if;
  return public.open_code_request(v_uid, 'reset_password', false);
end $$;

-- Status + countdown for the waiting screen. Callers: the request's user,
-- super admins, or the server (service role, for the anonymous reset flow).
create or replace function public.get_code_request(p_request_id uuid)
returns table (status public.code_status, purpose public.code_purpose, seconds_left int, phone text)
language sql stable security definer set search_path = '' as $$
  select public.code_effective_status(c),
         c.purpose,
         case when public.code_effective_status(c) = 'issued'
              then greatest(0, ceil(extract(epoch from c.expires_at - now())))::int else 0 end,
         c.phone
  from public.phone_codes c
  where c.id = p_request_id
    and (c.user_id = auth.uid() or public.is_super_admin() or auth.role() = 'service_role')
$$;

-- Latest verification request of the signed-in user (to resume the screen).
create or replace function public.my_open_verification()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.phone_codes c
  where c.user_id = auth.uid() and c.purpose = 'verify_phone'
    and public.code_effective_status(c) in ('requested', 'issued')
  order by c.requested_at desc limit 1
$$;

-- Admin generates (or regenerates) the code for a request. Returns the
-- plaintext code: the only time it exists outside the admin's call.
create or replace function public.admin_issue_code(p_request_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := public.random_digits6();
  v_ttl int;
  v_row public.phone_codes;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select code_ttl_seconds into v_ttl from public.platform_settings;
  update public.phone_codes c set
    status = 'issued',
    code_hash = public.code_hash(c.id, v_code),
    attempts = 0,
    issued_at = now(),
    expires_at = now() + make_interval(secs => v_ttl),
    issued_by = auth.uid()
  where c.id = p_request_id and c.status in ('requested', 'issued', 'expired')
  returning * into v_row;
  if not found then raise exception 'request_closed'; end if;
  perform public.write_audit('code.issued', null,
    jsonb_build_object('request_id', v_row.id, 'purpose', v_row.purpose, 'phone', v_row.phone));
  return query select v_code, v_row.expires_at;
end $$;

-- Admin creates a code without a prior request (e.g. while on a call).
create or replace function public.admin_create_code(p_phone text, p_purpose public.code_purpose)
returns table (request_id uuid, code text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into v_uid from public.profiles where phone = p_phone;
  if v_uid is null then raise exception 'no_account'; end if;
  v_id := public.open_code_request(v_uid, p_purpose, true);
  return query select v_id, i.code, i.expires_at from public.admin_issue_code(v_id) i;
end $$;

create or replace function public.admin_cancel_code(p_request_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.phone_codes set status = 'cancelled' where id = p_request_id and status in ('requested', 'issued');
end $$;

-- Open requests for the admin screen, newest first.
create or replace function public.admin_code_requests()
returns table (
  id uuid, purpose public.code_purpose, status public.code_status, phone text, full_name text,
  restaurants text, requested_at timestamptz, requested_by_admin boolean, seconds_left int, phone_verified boolean
)
language sql stable security definer set search_path = '' as $$
  select c.id, c.purpose, public.code_effective_status(c), c.phone, p.full_name,
    (select string_agg(r.name, ', ' order by r.name) from public.restaurant_members m
       join public.restaurants r on r.id = m.restaurant_id and r.deleted_at is null
       where m.user_id = c.user_id and m.invite_status = 'accepted'),
    c.requested_at, c.requested_by_admin,
    case when public.code_effective_status(c) = 'issued'
         then greatest(0, ceil(extract(epoch from c.expires_at - now())))::int else 0 end,
    p.phone_verified_at is not null
  from public.phone_codes c
  join public.profiles p on p.id = c.user_id
  where public.is_super_admin()
    and c.status in ('requested', 'issued')
    and c.requested_at > now() - interval '1 day'
  order by c.requested_at desc
$$;

-- Shared check. Returns 'ok' | 'invalid' | 'expired' | 'too_many' | 'no_code'.
create or replace function public.check_code(p_request public.phone_codes, p_code text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_max int;
begin
  if p_request.id is null or p_request.status <> 'issued' then return 'no_code'; end if;
  if p_request.expires_at <= now() then
    update public.phone_codes set status = 'expired' where id = p_request.id;
    return 'expired';
  end if;
  select code_max_attempts into v_max from public.platform_settings;
  if public.code_hash(p_request.id, coalesce(p_code, '')) = p_request.code_hash then
    update public.phone_codes set status = 'used', used_at = now(), attempts = attempts + 1 where id = p_request.id;
    update public.profiles set phone_verified_at = coalesce(phone_verified_at, now()) where id = p_request.user_id;
    return 'ok';
  end if;
  if p_request.attempts + 1 >= v_max then
    update public.phone_codes set status = 'expired', attempts = attempts + 1 where id = p_request.id;
    return 'too_many';
  end if;
  update public.phone_codes set attempts = attempts + 1 where id = p_request.id;
  return 'invalid';
end $$;

create or replace function public.verify_phone_code(p_code text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare r public.phone_codes;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into r from public.phone_codes
  where user_id = auth.uid() and purpose = 'verify_phone' and status = 'issued'
  order by issued_at desc limit 1 for update;
  return public.check_code(r, p_code);
end $$;

-- Reset flow (service role only). Returns the user id on success so the
-- server can set the new password through the Auth admin API.
create or replace function public.consume_reset_code(p_request_id uuid, p_code text)
returns table (result text, user_id uuid)
language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.phone_codes;
  v_result text;
begin
  select * into r from public.phone_codes c
  where c.id = p_request_id and c.purpose = 'reset_password' for update;
  v_result := public.check_code(r, p_code);
  return query select v_result, case when v_result = 'ok' then r.user_id end;
end $$;

-- ---------------------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------------------
create or replace function public.default_template_for(p_type public.restaurant_type)
returns text language sql immutable as $$
  select case p_type
    when 'pizzeria' then 'pizzeria' when 'fast_food' then 'pizzeria'
    when 'cafe' then 'cafe' when 'restaurant' then 'traditionnel' when 'traditional' then 'traditionnel'
    when 'gastronomic' then 'gastro' when 'patisserie' then 'patisserie' when 'glacier' then 'patisserie'
    when 'grill' then 'grill' when 'juice_bar' then 'jus' when 'seafood' then 'mer'
    when 'coffee_shop' then 'coffee' else 'cafe' end
$$;

-- Step 1 of onboarding. One owned restaurant per account for now.
create or replace function public.create_restaurant(
  p_name text,
  p_slug text,
  p_type public.restaurant_type,
  p_wilaya_code smallint,
  p_commune text default null,
  p_address text default null,
  p_whatsapp_order_phone text default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_trial int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if exists (
    select 1 from public.restaurant_members m join public.restaurants r on r.id = m.restaurant_id
    where m.user_id = v_uid and m.role = 'owner' and m.invite_status = 'accepted' and r.deleted_at is null
  ) then
    raise exception 'already_owner';
  end if;
  if not public.is_slug_available(p_slug) then
    raise exception 'slug_unavailable' using errcode = '23505';
  end if;
  select trial_days into v_trial from public.platform_settings;
  insert into public.restaurants (
    slug, name, type, wilaya_code, commune, address, whatsapp_order_phone,
    template_key, trial_ends_at, status, onboarding_step,
    orders_enabled
  ) values (
    p_slug, p_name, p_type, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''), nullif(p_whatsapp_order_phone, ''),
    public.default_template_for(p_type), now() + make_interval(days => v_trial), 'trial', 2,
    nullif(p_whatsapp_order_phone, '') is not null
  ) returning id into v_id;
  insert into public.restaurant_members (restaurant_id, user_id, role, invite_status)
  values (v_id, v_uid, 'owner', 'accepted');
  perform public.write_audit('restaurant.created', v_id, jsonb_build_object('slug', p_slug));
  return v_id;
end $$;

grant update (went_live_at) on public.restaurants to authenticated;

-- Invitations: the page shows who invited you before you sign in.
create or replace function public.get_invite(p_token text)
returns table (restaurant_name text, invited_phone text, status public.invite_status)
language sql stable security definer set search_path = '' as $$
  select r.name, m.invited_phone, m.invite_status
  from public.restaurant_members m join public.restaurants r on r.id = m.restaurant_id
  where m.invite_token = p_token and r.deleted_at is null
$$;

create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  m public.restaurant_members;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into m from public.restaurant_members
  where invite_token = p_token and invite_status = 'pending' for update;
  if not found then raise exception 'invite_invalid'; end if;
  if exists (select 1 from public.restaurant_members where restaurant_id = m.restaurant_id and user_id = v_uid) then
    raise exception 'already_member';
  end if;
  update public.restaurant_members
  set user_id = v_uid, invite_status = 'accepted', invite_token = null
  where id = m.id;
  perform public.write_audit('member.joined', m.restaurant_id, jsonb_build_object('user_id', v_uid));
  return m.restaurant_id;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function
  public.request_phone_verification(),
  public.get_code_request(uuid),
  public.my_open_verification(),
  public.verify_phone_code(text),
  public.admin_issue_code(uuid),
  public.admin_create_code(text, public.code_purpose),
  public.admin_cancel_code(uuid),
  public.admin_code_requests(),
  public.create_restaurant(text, text, public.restaurant_type, smallint, text, text, text),
  public.accept_invite(text)
to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;

-- The service role (server code, jobs) may call every function.
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant execute on functions to service_role;
