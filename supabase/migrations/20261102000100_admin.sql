-- Phase 8: admin back office.
-- 1. Super admin powers require a two-factor session (aal2) at the database.
-- 2. Every admin mutation goes through a security-definer RPC that writes audit_log;
--    direct writes on admin tables are revoked.

-- ---------------------------------------------------------------------------
-- MFA: a super admin without an aal2 session is treated as a regular user.
-- service_role (jobs, seeds) keeps full access as before.
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Lets the admin layout tell "not an admin" from "admin, second factor missing".
create or replace function public.is_admin_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;
grant execute on function public.is_admin_account() to authenticated;

create or replace function public._require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;
revoke execute on function public._require_admin() from public, anon, authenticated;

-- Admin writes only through the audited RPCs below.
do $$
declare t text;
begin
  foreach t in array array['admin_calls', 'admin_notes', 'reserved_slugs', 'platform_settings', 'templates'] loop
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Lists
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.restaurants where deleted_at is null group by 1) s),
    'signups_7d', (select count(*) from public.restaurants where deleted_at is null and created_at > now() - interval '7 days'),
    'live', (select count(*) from public.restaurants where deleted_at is null and went_live_at is not null),
    'trials_ending_2d', (select count(*) from public.restaurants where deleted_at is null and status = 'trial' and trial_ends_at < now() + interval '2 days'),
    'renewals_30d', (select count(*) from public.restaurants where deleted_at is null and status in ('active', 'grace') and paid_until < now() + interval '30 days'),
    'payments_pending', (select count(*) from public.payments where status = 'pending'),
    'kits_open', (select count(*) from public.kit_orders where stage <> 'paid'),
    'revenue_month', (select coalesce(sum(amount), 0) from public.payments where status = 'approved' and reviewed_at >= date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers'),
    'mrr', (select coalesce(round(sum(case plan when 'monthly' then s.price_monthly when 'semiannual' then s.price_semiannual / 6.0 else s.price_annual / 12.0 end)), 0)
            from public.restaurants r, public.platform_settings s where r.deleted_at is null and r.status = 'active' and r.plan is not null),
    'visits_7d', (select count(*) from public.menu_events where created_at > now() - interval '7 days' and kind in ('view_table', 'view_order')),
    'orders_7d', (select count(*) from public.orders where created_at > now() - interval '7 days' and status = 'sent')
  );
end $$;

create or replace function public.admin_restaurants()
returns table (
  id uuid, slug text, name text, type public.restaurant_type, wilaya_code smallint, commune text, status public.restaurant_status,
  plan public.subscription_plan, trial_ends_at timestamptz, paid_until timestamptz, created_at timestamptz, went_live_at timestamptz,
  owner_name text, owner_phone text, items int, visits_7d int, visits_30d int, last_call_at timestamptz, last_call_outcome public.admin_call_outcome
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
  select r.id, r.slug, r.name, r.type, r.wilaya_code, r.commune, r.status, r.plan, r.trial_ends_at, r.paid_until, r.created_at, r.went_live_at,
         p.full_name, p.phone,
         (select count(*)::int from public.items i where i.restaurant_id = r.id and i.deleted_at is null),
         (select count(*)::int from public.menu_events e where e.restaurant_id = r.id and e.created_at > now() - interval '7 days' and e.kind in ('view_table', 'view_order')),
         (select count(*)::int from public.menu_events e where e.restaurant_id = r.id and e.created_at > now() - interval '30 days' and e.kind in ('view_table', 'view_order')),
         c.created_at, c.outcome
  from public.restaurants r
  left join lateral (
    select m.user_id from public.restaurant_members m where m.restaurant_id = r.id and m.role = 'owner' and m.invite_status = 'accepted' limit 1
  ) o on true
  left join public.profiles p on p.id = o.user_id
  left join lateral (
    select ac.created_at, ac.outcome from public.admin_calls ac where ac.restaurant_id = r.id order by ac.created_at desc limit 1
  ) c on true
  where r.deleted_at is null
  order by r.created_at desc
  limit 2000;
end $$;

-- ---------------------------------------------------------------------------
-- Restaurant actions
-- ---------------------------------------------------------------------------
create or replace function public.admin_extend_trial(p_restaurant_id uuid, p_days int)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare v timestamptz;
begin
  perform public._require_admin();
  if p_days not between 1 and 90 then raise exception 'invalid_days' using errcode = '22023'; end if;
  update public.restaurants set trial_ends_at = greatest(trial_ends_at, now()) + make_interval(days => p_days),
    status = case when status in ('grace', 'expired') and paid_until is null then 'trial'::public.restaurant_status else status end
  where id = p_restaurant_id and deleted_at is null returning trial_ends_at into v;
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._sync_subscription(p_restaurant_id);
  perform public.write_audit('admin.trial_extended', p_restaurant_id, jsonb_build_object('days', p_days, 'trial_ends_at', v));
  return v;
end $$;

-- Manual activation (cash handed over, goodwill...): active with this plan until the date.
create or replace function public.admin_activate_until(p_restaurant_id uuid, p_until date, p_plan public.subscription_plan)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if p_until <= current_date or p_until > current_date + 800 then raise exception 'invalid_date' using errcode = '22023'; end if;
  update public.restaurants set paid_until = (p_until + 1)::timestamp at time zone 'Africa/Algiers', plan = p_plan,
    status = case when status = 'suspended' then status else 'active'::public.restaurant_status end
  where id = p_restaurant_id and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._sync_subscription(p_restaurant_id);
  perform public.notify(p_restaurant_id, 'payment_approved', jsonb_build_object('plan', p_plan, 'paid_until', (p_until + 1)::timestamp at time zone 'Africa/Algiers', 'manual', true));
  perform public.write_audit('admin.activated', p_restaurant_id, jsonb_build_object('until', p_until, 'plan', p_plan));
end $$;

create or replace function public.admin_set_suspended(p_restaurant_id uuid, p_suspended boolean, p_reason text default null)
returns public.restaurant_status language plpgsql volatile security definer set search_path = '' as $$
declare v public.restaurant_status;
begin
  perform public._require_admin();
  if p_suspended and coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  -- Unsuspending goes back through the state machine (trial/active/grace/expired).
  update public.restaurants set status = (case when p_suspended then 'suspended' else 'trial' end)::public.restaurant_status
  where id = p_restaurant_id and deleted_at is null;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_suspended then
    v := 'suspended';
  else
    update public.restaurants set status = public.subscription_status_for('trial', trial_ends_at, paid_until, (select grace_days from public.platform_settings))
    where id = p_restaurant_id returning status into v;
  end if;
  perform public.write_audit(case when p_suspended then 'admin.suspended' else 'admin.unsuspended' end, p_restaurant_id, jsonb_build_object('reason', p_reason));
  return v;
end $$;

create or replace function public.admin_add_note(p_restaurant_id uuid, p_body text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v uuid;
begin
  perform public._require_admin();
  if coalesce(btrim(p_body), '') = '' then raise exception 'required' using errcode = '22023'; end if;
  insert into public.admin_notes (restaurant_id, admin_id, body) values (p_restaurant_id, auth.uid(), left(btrim(p_body), 2000)) returning id into v;
  perform public.write_audit('admin.note', p_restaurant_id, jsonb_build_object('note_id', v));
  return v;
end $$;

create or replace function public.admin_log_call(p_restaurant_id uuid, p_outcome public.admin_call_outcome, p_note text default null, p_next_action_at timestamptz default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v uuid;
begin
  perform public._require_admin();
  insert into public.admin_calls (restaurant_id, admin_id, outcome, note, next_action_at, next_action)
  values (p_restaurant_id, auth.uid(), p_outcome, nullif(left(btrim(p_note), 1000), ''), p_next_action_at, case when p_next_action_at is not null then 'call' end)
  returning id into v;
  perform public.write_audit('admin.call', p_restaurant_id, jsonb_build_object('outcome', p_outcome));
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Daily call list and renewals
-- ---------------------------------------------------------------------------
-- Trials ending within 2 days (and fresh grace), most engaged first.
create or replace function public.admin_call_list()
returns table (id uuid, name text, slug text, status public.restaurant_status, ends_at timestamptz, owner_name text, owner_phone text,
               visits_7d int, items int, called_today boolean, last_outcome public.admin_call_outcome)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
  select a.id, a.name, a.slug, a.status, coalesce(a.paid_until, a.trial_ends_at), a.owner_name, a.owner_phone, a.visits_7d, a.items,
         coalesce(a.last_call_at >= date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers', false), a.last_call_outcome
  from public.admin_restaurants() a
  where a.paid_until is null and (
    (a.status = 'trial' and a.trial_ends_at < now() + interval '2 days')
    or (a.status = 'grace' and a.trial_ends_at > now() - interval '3 days'))
  order by a.visits_7d desc, a.trial_ends_at;
end $$;

-- Paid restaurants whose subscription ends within 30 days (or is in grace).
create or replace function public.admin_renewals()
returns table (id uuid, name text, slug text, status public.restaurant_status, plan public.subscription_plan, paid_until timestamptz,
               owner_name text, owner_phone text, reminded_at timestamptz, pending_payment boolean, last_call_at timestamptz, last_outcome public.admin_call_outcome)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query
  select a.id, a.name, a.slug, a.status, a.plan, a.paid_until, a.owner_name, a.owner_phone,
         (select max(n.created_at) from public.notifications n where n.restaurant_id = a.id and n.kind in ('renewal_due', 'subscription_grace') and n.created_at > a.paid_until - interval '30 days'),
         exists (select 1 from public.payments p where p.restaurant_id = a.id and p.status = 'pending'),
         a.last_call_at, a.last_call_outcome
  from public.admin_restaurants() a
  where a.paid_until is not null and a.paid_until < now() + interval '30 days' and a.status in ('active', 'grace')
  order by a.paid_until;
end $$;

-- ---------------------------------------------------------------------------
-- Settings, templates, reserved slugs
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_settings(p jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  before jsonb;
begin
  perform public._require_admin();
  select to_jsonb(s) into before from public.platform_settings s;
  update public.platform_settings set
    price_monthly = coalesce((p ->> 'price_monthly')::int, price_monthly),
    price_semiannual = coalesce((p ->> 'price_semiannual')::int, price_semiannual),
    price_annual = coalesce((p ->> 'price_annual')::int, price_annual),
    kit_price = coalesce((p ->> 'kit_price')::int, kit_price),
    trial_days = coalesce((p ->> 'trial_days')::int, trial_days),
    grace_days = coalesce((p ->> 'grace_days')::int, grace_days),
    baridimob_rip = case when p ? 'baridimob_rip' then nullif(btrim(p ->> 'baridimob_rip'), '') else baridimob_rip end,
    ccp_number = case when p ? 'ccp_number' then nullif(btrim(p ->> 'ccp_number'), '') else ccp_number end,
    ccp_key = case when p ? 'ccp_key' then nullif(btrim(p ->> 'ccp_key'), '') else ccp_key end,
    ccp_holder = case when p ? 'ccp_holder' then nullif(btrim(p ->> 'ccp_holder'), '') else ccp_holder end,
    code_ttl_seconds = coalesce((p ->> 'code_ttl_seconds')::int, code_ttl_seconds),
    code_max_attempts = coalesce((p ->> 'code_max_attempts')::int, code_max_attempts),
    code_requests_per_hour = coalesce((p ->> 'code_requests_per_hour')::int, code_requests_per_hour),
    waiter_call_cooldown_sec = coalesce((p ->> 'waiter_call_cooldown_sec')::int, waiter_call_cooldown_sec),
    block_after_reports = coalesce((p ->> 'block_after_reports')::int, block_after_reports),
    ai_imports_per_trial = coalesce((p ->> 'ai_imports_per_trial')::int, ai_imports_per_trial);
  perform public.write_audit('admin.settings', null, jsonb_build_object('before', before - 'updated_at' - 'created_at', 'changes', p));
exception when check_violation or invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_settings' using errcode = '22023';
end $$;

alter table public.platform_settings
  add constraint platform_settings_ranges check (
    price_monthly > 0 and price_semiannual > 0 and price_annual > 0 and kit_price >= 0
    and trial_days between 1 and 60 and grace_days between 0 and 60
    and code_ttl_seconds between 30 and 900 and code_max_attempts between 1 and 10 and code_requests_per_hour between 1 and 20
    and waiter_call_cooldown_sec between 10 and 3600
    and block_after_reports between 1 and 20 and ai_imports_per_trial between 0 and 100);

create or replace function public.admin_set_template_active(p_key text, p_active boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._require_admin();
  update public.templates set is_active = p_active where key = p_key;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public.write_audit('admin.template', null, jsonb_build_object('key', p_key, 'active', p_active));
end $$;

create or replace function public.admin_reserve_slug(p_slug text, p_reserved boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v text := lower(btrim(p_slug));
begin
  perform public._require_admin();
  if v !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$' then raise exception 'invalid_slug' using errcode = '22023'; end if;
  if p_reserved then
    if exists (select 1 from public.restaurants where slug = v) then raise exception 'slug_in_use' using errcode = '23505'; end if;
    insert into public.reserved_slugs (slug) values (v) on conflict do nothing;
  else
    delete from public.reserved_slugs where slug = v;
  end if;
  perform public.write_audit(case when p_reserved then 'admin.slug_reserved' else 'admin.slug_released' end, null, jsonb_build_object('slug', v));
end $$;

-- Read-only "view as owner" sessions are audited when they start.
create or replace function public.admin_log_impersonation(p_restaurant_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._require_admin();
  perform public.write_audit('admin.view_as', p_restaurant_id, '{}');
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.admin_overview(), public.admin_restaurants(), public.admin_extend_trial(uuid, int),
  public.admin_activate_until(uuid, date, public.subscription_plan), public.admin_set_suspended(uuid, boolean, text),
  public.admin_add_note(uuid, text), public.admin_log_call(uuid, public.admin_call_outcome, text, timestamptz),
  public.admin_call_list(), public.admin_renewals(), public.admin_update_settings(jsonb),
  public.admin_set_template_active(text, boolean), public.admin_reserve_slug(text, boolean), public.admin_log_impersonation(uuid)
from public, anon;
grant execute on function
  public.admin_overview(), public.admin_restaurants(), public.admin_extend_trial(uuid, int),
  public.admin_activate_until(uuid, date, public.subscription_plan), public.admin_set_suspended(uuid, boolean, text),
  public.admin_add_note(uuid, text), public.admin_log_call(uuid, public.admin_call_outcome, text, timestamptz),
  public.admin_call_list(), public.admin_renewals(), public.admin_update_settings(jsonb),
  public.admin_set_template_active(text, boolean), public.admin_reserve_slug(text, boolean), public.admin_log_impersonation(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Login limiter counts failures only (successful logins of busy owners and
-- admins never lock the account): peek before trying, hit after a failure.
-- ---------------------------------------------------------------------------
create or replace function public.rate_limit_exceeded(p_key text, p_max int, p_window_seconds int)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select count >= p_max from public.rate_limits
    where key = p_key and window_start = to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)
  ), false)
$$;
revoke execute on function public.rate_limit_exceeded(text, int, int) from public, anon, authenticated;
