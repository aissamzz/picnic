-- Phase 7: subscription engine, payments, kit, notifications, referral.
-- Money and dates are computed here from platform_settings, never sent by the
-- browser. Admin actions (approve/reject, kit stages) are audited.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------
alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe_idx on public.notifications (restaurant_id, dedupe_key) where dedupe_key is not null;

alter table public.payments add column period_start timestamptz, add column period_end timestamptz;
create unique index payments_one_pending_idx on public.payments (restaurant_id) where status = 'pending';

alter table public.kit_orders add column delivered_at timestamptz;
create unique index kit_orders_one_open_idx on public.kit_orders (restaurant_id) where stage <> 'paid';

alter table public.restaurants add column referral_rewarded_at timestamptz;

-- The browser goes through the RPCs below for these.
revoke insert on public.payments from authenticated;
revoke insert on public.kit_orders from authenticated;

-- ---------------------------------------------------------------------------
-- Notifications (in-app; replaces SMS to owners, see DECISIONS)
-- ---------------------------------------------------------------------------
create or replace function public.notify(p_restaurant_id uuid, p_kind text, p_payload jsonb default '{}', p_dedupe text default null)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.notifications (restaurant_id, kind, payload, dedupe_key)
  values (p_restaurant_id, p_kind, coalesce(p_payload, '{}'), p_dedupe)
  on conflict (restaurant_id, dedupe_key) where dedupe_key is not null do nothing
$$;
revoke execute on function public.notify(uuid, text, jsonb, text) from public, anon, authenticated;

create or replace function public.mark_notifications_read(p_restaurant_id uuid)
returns void language sql volatile as $$
  update public.notifications set read_at = now()
  where restaurant_id = p_restaurant_id and read_at is null
$$;

-- ---------------------------------------------------------------------------
-- State machine (mirrors lib/subscription/state.ts)
-- ---------------------------------------------------------------------------
create or replace function public.subscription_status_for(
  p_status public.restaurant_status, p_trial_ends_at timestamptz, p_paid_until timestamptz, p_grace_days int, p_now timestamptz default now()
) returns public.restaurant_status language sql immutable as $$
  select case
    when p_status in ('suspended', 'paused') then p_status::text
    when p_paid_until is not null then
      case when p_now < p_paid_until then 'active'
           when p_now < p_paid_until + make_interval(days => p_grace_days) then 'grace'
           else 'expired' end
    when p_now < p_trial_ends_at then 'trial'
    when p_now < p_trial_ends_at + make_interval(days => p_grace_days) then 'grace'
    else 'expired'
  end::public.restaurant_status
$$;

-- Applies the state machine to one restaurant and posts the matching
-- notifications (deduplicated, so running it often is harmless).
create or replace function public._sync_subscription(p_restaurant_id uuid)
returns public.restaurant_status language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.restaurants;
  v_grace int;
  v_new public.restaurant_status;
  v_end timestamptz;
begin
  select * into r from public.restaurants where id = p_restaurant_id and deleted_at is null for update;
  if not found then return null; end if;
  select grace_days into v_grace from public.platform_settings;
  v_new := public.subscription_status_for(r.status, r.trial_ends_at, r.paid_until, v_grace);
  v_end := coalesce(r.paid_until, r.trial_ends_at);

  if v_new is distinct from r.status then
    update public.restaurants set status = v_new where id = r.id;
    if v_new in ('grace', 'expired') then
      perform public.notify(r.id, 'subscription_' || v_new::text,
        jsonb_build_object('ends_at', v_end + make_interval(days => v_grace)), v_new::text || ':' || v_end::date);
    end if;
  end if;

  -- Reminders: 2 days before the trial ends (day 12), 7 days before renewal.
  if v_new = 'trial' and r.trial_ends_at - now() <= interval '2 days' then
    perform public.notify(r.id, 'trial_ending', jsonb_build_object('ends_at', r.trial_ends_at), 'trial_ending:' || r.trial_ends_at::date);
  elsif v_new = 'active' and r.paid_until - now() <= interval '7 days' then
    perform public.notify(r.id, 'renewal_due', jsonb_build_object('ends_at', r.paid_until), 'renewal_due:' || r.paid_until::date);
  end if;
  return v_new;
end $$;
revoke execute on function public._sync_subscription(uuid) from public, anon, authenticated;

-- Request guard: the owner app calls this before reading its restaurant.
create or replace function public.sync_subscription(p_restaurant_id uuid)
returns public.restaurant_status language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_member(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public._sync_subscription(p_restaurant_id);
end $$;

-- Nightly job: every restaurant whose state can move.
create or replace function public.run_subscription_tick()
returns int language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in select id from public.restaurants where deleted_at is null and status in ('trial', 'active', 'grace') loop
    perform public._sync_subscription(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.run_subscription_tick() from public, anon, authenticated;

-- Hosted Supabase: pg_cron runs the tick at 02:15 Algiers time (01:15 UTC).
-- Elsewhere, call POST /api/cron/subscriptions with CRON_SECRET (DEPLOY.md).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('subscription-tick', '15 1 * * *', 'select public.run_subscription_tick()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create or replace function public.plan_price(p_plan public.subscription_plan)
returns int language sql stable security definer set search_path = '' as $$
  select case p_plan when 'monthly' then price_monthly when 'semiannual' then price_semiannual else price_annual end
  from public.platform_settings
$$;

-- Owner declares a transfer with its receipt. One pending payment at a time.
create or replace function public.submit_payment(p_restaurant_id uuid, p_plan public.subscription_plan, p_method public.payment_method, p_receipt_path text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if public.member_role(p_restaurant_id) is distinct from 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_method not in ('baridimob', 'ccp', 'cash') then raise exception 'invalid_method' using errcode = '22023'; end if;
  if p_receipt_path is null or p_receipt_path not like p_restaurant_id::text || '/%' then raise exception 'invalid_receipt' using errcode = '22023'; end if;
  if exists (select 1 from public.payments where restaurant_id = p_restaurant_id and status = 'pending') then
    raise exception 'pending_exists' using errcode = 'P0001';
  end if;
  insert into public.payments (restaurant_id, method, plan, amount, reference, receipt_path)
  select p_restaurant_id, p_method, p_plan, public.plan_price(p_plan), r.payment_reference, p_receipt_path
  from public.restaurants r where r.id = p_restaurant_id
  returning id into v_id;
  perform public.write_audit('payment.submitted', p_restaurant_id, jsonb_build_object('payment_id', v_id, 'plan', p_plan, 'method', p_method));
  return v_id;
end $$;

-- Extends a subscription by a plan from max(now, paid_until). Internal.
create or replace function public._extend_subscription(p_restaurant_id uuid, p_months int, p_from timestamptz default null)
returns table (period_start timestamptz, period_end timestamptz) language plpgsql volatile security definer set search_path = '' as $$
declare
  v_start timestamptz;
begin
  select greatest(coalesce(p_from, now()), coalesce(r.paid_until, '-infinity')) into v_start from public.restaurants r where r.id = p_restaurant_id for update;
  period_start := v_start;
  period_end := v_start + make_interval(months => p_months);
  update public.restaurants set paid_until = period_end where id = p_restaurant_id;
  perform public._sync_subscription(p_restaurant_id);
  return next;
end $$;
revoke execute on function public._extend_subscription(uuid, int, timestamptz) from public, anon, authenticated;

-- First approved payment of a referred restaurant: one free month for the referrer.
create or replace function public._reward_referral(p_restaurant_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.restaurants;
  ref public.restaurants;
begin
  select * into r from public.restaurants where id = p_restaurant_id for update;
  if r.referred_by is null or r.referral_rewarded_at is not null then return; end if;
  select * into ref from public.restaurants where id = r.referred_by and deleted_at is null for update;
  if not found then return; end if;
  update public.restaurants set referral_rewarded_at = now() where id = r.id;
  if ref.status = 'trial' and ref.paid_until is null then
    update public.restaurants set trial_ends_at = trial_ends_at + interval '1 month' where id = ref.id;
    perform public._sync_subscription(ref.id);
  else
    perform public._extend_subscription(ref.id, 1);
  end if;
  perform public.notify(ref.id, 'referral_reward', jsonb_build_object('restaurant', r.name), 'referral:' || r.id);
  perform public.write_audit('referral.rewarded', ref.id, jsonb_build_object('referred', r.id));
end $$;
revoke execute on function public._reward_referral(uuid) from public, anon, authenticated;

create or replace function public.approve_payment(p_payment_id uuid)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.payments;
  v_months int;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found or p.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0002'; end if;
  v_months := case p.plan when 'monthly' then 1 when 'semiannual' then 6 else 12 end;
  select e.period_start, e.period_end into v_start, v_end from public._extend_subscription(p.restaurant_id, v_months) e;
  update public.restaurants set plan = p.plan where id = p.restaurant_id;
  update public.payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), period_start = v_start, period_end = v_end
  where id = p.id;
  perform public.notify(p.restaurant_id, 'payment_approved', jsonb_build_object('payment_id', p.id, 'plan', p.plan, 'paid_until', v_end));
  perform public.write_audit('payment.approved', p.restaurant_id, jsonb_build_object('payment_id', p.id, 'plan', p.plan, 'amount', p.amount, 'paid_until', v_end));
  perform public._reward_referral(p.restaurant_id);
  return v_end;
end $$;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  p public.payments;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found or p.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0002'; end if;
  update public.payments set status = 'rejected', reject_reason = left(btrim(p_reason), 200), reviewed_by = auth.uid(), reviewed_at = now() where id = p.id;
  perform public.notify(p.restaurant_id, 'payment_rejected', jsonb_build_object('payment_id', p.id, 'reason', left(btrim(p_reason), 200)));
  perform public.write_audit('payment.rejected', p.restaurant_id, jsonb_build_object('payment_id', p.id, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Kit: printed plexiglass QR stands + posters, paid cash on delivery together
-- with an annual subscription that starts on the delivery date.
-- ---------------------------------------------------------------------------
create or replace function public._kit_step(k public.kit_orders, p_stage public.kit_stage, p_extra jsonb default '{}')
returns jsonb language sql stable as $$
  select k.timeline || jsonb_build_array(jsonb_build_object('stage', p_stage, 'at', now()) || coalesce(p_extra, '{}'))
$$;

create or replace function public.order_kit(
  p_restaurant_id uuid, p_stands int, p_posters int, p_wilaya_code smallint, p_commune text, p_address text, p_phone text
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if public.member_role(p_restaurant_id) is distinct from 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_stands not between 1 and 50 or p_posters not between 0 and 20 then raise exception 'invalid_counts' using errcode = '22023'; end if;
  if coalesce(btrim(p_address), '') = '' or p_phone !~ '^\+213[0-9]{8,9}$' or p_wilaya_code not between 1 and 69 then
    raise exception 'invalid_address' using errcode = '22023';
  end if;
  if exists (select 1 from public.kit_orders where restaurant_id = p_restaurant_id and stage <> 'paid') then
    raise exception 'kit_open' using errcode = 'P0001';
  end if;
  insert into public.kit_orders (restaurant_id, stands_count, posters_count, wilaya_code, commune, address, phone, cod_amount, timeline)
  select p_restaurant_id, p_stands, p_posters, p_wilaya_code, nullif(btrim(p_commune), ''), btrim(p_address), p_phone,
         s.kit_price + s.price_annual, jsonb_build_array(jsonb_build_object('stage', 'ordered', 'at', now()))
  from public.platform_settings s
  returning id into v_id;
  perform public.write_audit('kit.ordered', p_restaurant_id, jsonb_build_object('kit_id', v_id));
  return v_id;
end $$;

-- Admin: upload a (new) mockup for the owner to approve.
create or replace function public.kit_set_mockup(p_kit_id uuid, p_path text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  k public.kit_orders;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into k from public.kit_orders where id = p_kit_id for update;
  if not found or k.stage not in ('ordered', 'mockup') then raise exception 'bad_stage' using errcode = 'P0001'; end if;
  if p_path not like k.restaurant_id::text || '/%' then raise exception 'invalid_path' using errcode = '22023'; end if;
  update public.kit_orders set stage = 'mockup', mockup_path = p_path, owner_feedback = null, timeline = public._kit_step(k, 'mockup') where id = k.id;
  perform public.notify(k.restaurant_id, 'kit_mockup', jsonb_build_object('kit_id', k.id));
  perform public.write_audit('kit.mockup', k.restaurant_id, jsonb_build_object('kit_id', k.id));
end $$;

-- Owner: approve the mockup or ask for changes.
create or replace function public.review_kit_mockup(p_kit_id uuid, p_approve boolean, p_feedback text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  k public.kit_orders;
begin
  select * into k from public.kit_orders where id = p_kit_id for update;
  if not found or public.member_role(k.restaurant_id) is distinct from 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  if k.stage <> 'mockup' or k.mockup_path is null or k.owner_feedback is not null then raise exception 'bad_stage' using errcode = 'P0001'; end if;
  if p_approve then
    update public.kit_orders set stage = 'approved', timeline = public._kit_step(k, 'approved') where id = k.id;
  else
    if coalesce(btrim(p_feedback), '') = '' then raise exception 'feedback_required' using errcode = '22023'; end if;
    update public.kit_orders set owner_feedback = left(btrim(p_feedback), 500),
      timeline = public._kit_step(k, 'mockup', jsonb_build_object('changes', left(btrim(p_feedback), 500))) where id = k.id;
  end if;
  perform public.write_audit(case when p_approve then 'kit.approved' else 'kit.changes_requested' end, k.restaurant_id, jsonb_build_object('kit_id', k.id));
end $$;

-- Admin: printed -> shipped (tracking) -> delivered -> paid (COD collected:
-- records the payment and starts the annual plan on the delivery date).
create or replace function public.kit_advance(p_kit_id uuid, p_stage public.kit_stage, p_tracking text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  k public.kit_orders;
  v_expected public.kit_stage;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_super_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into k from public.kit_orders where id = p_kit_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_expected := case k.stage when 'approved' then 'printed' when 'printed' then 'shipped' when 'shipped' then 'delivered' when 'delivered' then 'paid' end;
  if v_expected is null or p_stage <> v_expected then raise exception 'bad_stage' using errcode = 'P0001'; end if;

  update public.kit_orders set
    stage = p_stage,
    tracking_number = case when p_stage = 'shipped' then nullif(btrim(p_tracking), '') else tracking_number end,
    delivered_at = case when p_stage = 'delivered' then now() else delivered_at end,
    timeline = public._kit_step(k, p_stage, case when p_stage = 'shipped' and nullif(btrim(p_tracking), '') is not null then jsonb_build_object('tracking', btrim(p_tracking)) else '{}' end)
  where id = k.id;

  if p_stage = 'paid' then
    select e.period_start, e.period_end into v_start, v_end from public._extend_subscription(k.restaurant_id, 12, k.delivered_at) e;
    update public.restaurants set plan = 'annual' where id = k.restaurant_id;
    insert into public.payments (restaurant_id, method, plan, amount, reference, status, reviewed_by, reviewed_at, period_start, period_end)
    select k.restaurant_id, 'cod', 'annual', k.cod_amount, r.payment_reference, 'approved', auth.uid(), now(), v_start, v_end
    from public.restaurants r where r.id = k.restaurant_id;
    perform public.notify(k.restaurant_id, 'payment_approved', jsonb_build_object('plan', 'annual', 'paid_until', v_end, 'kit', true));
    perform public._reward_referral(k.restaurant_id);
  else
    perform public.notify(k.restaurant_id, 'kit_' || p_stage::text, jsonb_build_object('kit_id', k.id, 'tracking', nullif(btrim(p_tracking), '')));
  end if;
  perform public.write_audit('kit.' || p_stage::text, k.restaurant_id, jsonb_build_object('kit_id', k.id));
end $$;

-- ---------------------------------------------------------------------------
-- Referral
-- ---------------------------------------------------------------------------
create or replace function public.my_referrals(p_restaurant_id uuid)
returns table (name text, created_at timestamptz, rewarded boolean) language sql stable security definer set search_path = '' as $$
  select r.name, r.created_at, r.referral_rewarded_at is not null
  from public.restaurants r
  where r.referred_by = p_restaurant_id and r.deleted_at is null and public.is_owner(p_restaurant_id)
  order by r.created_at desc
$$;

-- create_restaurant gains the referral code read from the signup link.
drop function public.create_restaurant(text, text, public.restaurant_type, smallint, text, text, text);
create function public.create_restaurant(
  p_name text,
  p_slug text,
  p_type public.restaurant_type,
  p_wilaya_code smallint,
  p_commune text default null,
  p_address text default null,
  p_whatsapp_order_phone text default null,
  p_referral_code text default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_trial int;
  v_ref uuid;
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
  select id into v_ref from public.restaurants where referral_code = upper(btrim(p_referral_code)) and deleted_at is null;
  insert into public.restaurants (
    slug, name, type, wilaya_code, commune, address, whatsapp_order_phone,
    template_key, trial_ends_at, status, onboarding_step,
    orders_enabled, referred_by
  ) values (
    p_slug, p_name, p_type, p_wilaya_code, nullif(p_commune, ''), nullif(p_address, ''), nullif(p_whatsapp_order_phone, ''),
    public.default_template_for(p_type), now() + make_interval(days => v_trial), 'trial', 2,
    nullif(p_whatsapp_order_phone, '') is not null, v_ref
  ) returning id into v_id;
  insert into public.restaurant_members (restaurant_id, user_id, role, invite_status)
  values (v_id, v_uid, 'owner', 'accepted');
  perform public.write_audit('restaurant.created', v_id, jsonb_build_object('slug', p_slug, 'referred_by', v_ref));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.mark_notifications_read(uuid), public.sync_subscription(uuid), public.plan_price(public.subscription_plan),
  public.submit_payment(uuid, public.subscription_plan, public.payment_method, text), public.approve_payment(uuid),
  public.reject_payment(uuid, text), public.order_kit(uuid, int, int, smallint, text, text, text),
  public.kit_set_mockup(uuid, text), public.review_kit_mockup(uuid, boolean, text), public.kit_advance(uuid, public.kit_stage, text),
  public.my_referrals(uuid), public.create_restaurant(text, text, public.restaurant_type, smallint, text, text, text, text)
from public, anon;
grant execute on function
  public.mark_notifications_read(uuid), public.sync_subscription(uuid), public.plan_price(public.subscription_plan),
  public.submit_payment(uuid, public.subscription_plan, public.payment_method, text), public.approve_payment(uuid),
  public.reject_payment(uuid, text), public.order_kit(uuid, int, int, smallint, text, text, text),
  public.kit_set_mockup(uuid, text), public.review_kit_mockup(uuid, boolean, text), public.kit_advance(uuid, public.kit_stage, text),
  public.my_referrals(uuid), public.create_restaurant(text, text, public.restaurant_type, smallint, text, text, text, text)
to authenticated;
grant execute on function public.run_subscription_tick() to service_role;

-- Payment details shown on the billing page (owners only need these).
create or replace function public.payment_details()
returns table (baridimob_rip text, ccp_number text, ccp_key text, ccp_holder text, price_monthly int, price_semiannual int, price_annual int, kit_price int)
language sql stable security definer set search_path = '' as $$
  select baridimob_rip, ccp_number, ccp_key, ccp_holder, price_monthly, price_semiannual, price_annual, kit_price
  from public.platform_settings
  where exists (select 1 from public.restaurant_members m where m.user_id = auth.uid() and m.role = 'owner') or public.is_super_admin()
$$;
revoke execute on function public.payment_details() from public, anon;
grant execute on function public.payment_details() to authenticated;
