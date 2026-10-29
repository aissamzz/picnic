-- Web push for the owner app (owners and staff, each phone subscribes on its own).
-- Waiter calls, orders and notifications drop a row in push_outbox (same
-- transaction); the app's dispatcher (/api/push/dispatch, pinged right after a
-- call or order, and by the nightly job) claims the rows and sends the pushes.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https?://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) <= 200),
  auth text not null check (length(auth) <= 100),
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  user_agent text check (length(user_agent) <= 300),
  last_success_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_restaurant_idx on public.push_subscriptions (restaurant_id);
create trigger push_subscriptions_updated_at before update on public.push_subscriptions for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
grant select, delete on public.push_subscriptions to authenticated;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Subscribe this phone for this restaurant (same endpoint re-subscribing moves it).
create or replace function public.save_push_subscription(p_restaurant_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_locale text, p_user_agent text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_member(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.push_subscriptions (user_id, restaurant_id, endpoint, p256dh, auth, locale, user_agent)
  values (auth.uid(), p_restaurant_id, p_endpoint, p_p256dh, p_auth, case when p_locale = 'ar' then 'ar' else 'fr' end, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, restaurant_id = excluded.restaurant_id, p256dh = excluded.p256dh,
    auth = excluded.auth, locale = excluded.locale, user_agent = excluded.user_agent;
end $$;

-- A member who leaves stops getting the restaurant's pushes.
create or replace function public.push_forget_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where restaurant_id = old.restaurant_id and user_id = old.user_id;
  return old;
end $$;
create trigger restaurant_members_push_forget after delete on public.restaurant_members
  for each row when (old.user_id is not null) execute function public.push_forget_member();

-- ---------------------------------------------------------------------------
-- Outbox
-- ---------------------------------------------------------------------------
create table public.push_outbox (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null,
  -- team: owners and staff; owners: billing, kit, referral.
  audience text not null check (audience in ('team', 'owners')),
  payload jsonb not null default '{}',
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_outbox_pending_idx on public.push_outbox (id) where claimed_at is null;
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

create or replace function public.push_enqueue_call()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_outbox (restaurant_id, kind, audience, payload)
  values (new.restaurant_id, 'waiter_call', 'team', jsonb_build_object(
    'id', new.id, 'call', new.kind,
    'table', (select t.label from public.tables t where t.id = new.table_id)));
  return new;
end $$;
create trigger waiter_calls_push after insert on public.waiter_calls for each row execute function public.push_enqueue_call();

create or replace function public.push_enqueue_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.push_outbox (restaurant_id, kind, audience, payload)
  values (new.restaurant_id, 'order', 'team', jsonb_build_object(
    'id', new.id, 'public_id', new.public_id, 'mode', new.mode,
    'total', new.subtotal + new.delivery_fee, 'customer', new.customer_name));
  return new;
end $$;
create trigger orders_push after insert on public.orders for each row execute function public.push_enqueue_order();

create or replace function public.push_enqueue_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.restaurant_id is not null then
    insert into public.push_outbox (restaurant_id, kind, audience, payload)
    values (new.restaurant_id, 'notification', 'owners', jsonb_build_object('id', new.id, 'kind', new.kind, 'payload', new.payload));
  end if;
  return new;
end $$;
create trigger notifications_push after insert on public.notifications for each row execute function public.push_enqueue_notification();

-- Dispatcher (service role): claims pending rows once. Rows older than a day
-- are dropped (a waiter call from yesterday is noise), claimed ones purged after 2 days.
create or replace function public.claim_push_batch(p_limit int default 50)
returns setof public.push_outbox language plpgsql volatile security definer set search_path = '' as $$
begin
  delete from public.push_outbox where created_at < now() - interval '2 days';
  return query
  with c as (
    select o.id from public.push_outbox o
    where o.claimed_at is null and o.created_at > now() - interval '1 day'
    order by o.id limit least(greatest(p_limit, 1), 200)
    for update skip locked
  )
  update public.push_outbox o set claimed_at = now() from c where o.id = c.id
  returning o.*;
end $$;

-- Phones to reach for a restaurant: accepted members, owners only for 'owners'.
create or replace function public.push_targets(p_restaurant_id uuid, p_audience text)
returns table (id uuid, endpoint text, p256dh text, auth text, locale text, restaurant_name text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.endpoint, s.p256dh, s.auth, s.locale, r.name
  from public.push_subscriptions s
  join public.restaurant_members m on m.restaurant_id = s.restaurant_id and m.user_id = s.user_id and m.invite_status = 'accepted'
  join public.restaurants r on r.id = s.restaurant_id and r.deleted_at is null
  where s.restaurant_id = p_restaurant_id and (p_audience = 'team' or m.role = 'owner')
$$;

grant all on public.push_subscriptions, public.push_outbox to service_role;

revoke execute on function public.claim_push_batch(int), public.push_targets(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_push_batch(int), public.push_targets(uuid, text) to service_role;
revoke execute on function public.save_push_subscription(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(uuid, text, text, text, text, text) to authenticated;
revoke execute on function public.push_enqueue_call(), public.push_enqueue_order(), public.push_enqueue_notification(), public.push_forget_member() from public, anon, authenticated;
