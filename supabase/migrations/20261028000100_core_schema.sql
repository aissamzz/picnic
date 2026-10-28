-- Core schema: enums, tables, indexes, triggers.
-- Translatable text is jsonb shaped {"fr": string, "ar": string}.
-- Money is integer DA.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.restaurant_type as enum (
  'pizzeria', 'fast_food', 'cafe', 'restaurant', 'traditional', 'gastronomic',
  'patisserie', 'glacier', 'grill', 'juice_bar', 'seafood', 'coffee_shop', 'other'
);
create type public.restaurant_status as enum ('trial', 'active', 'grace', 'expired', 'suspended', 'paused');
create type public.subscription_plan as enum ('monthly', 'semiannual', 'annual');
create type public.member_role as enum ('owner', 'staff');
create type public.invite_status as enum ('pending', 'accepted', 'revoked');
create type public.item_tag as enum ('new', 'spicy', 'vegetarian', 'best_seller', 'dish_of_day');
create type public.menu_event_kind as enum ('view_table', 'view_order', 'item_view', 'order_sent', 'waiter_call');
create type public.traffic_source as enum ('table', 'instagram', 'facebook', 'tiktok', 'poster', 'direct', 'whatsapp');
create type public.order_mode as enum ('delivery', 'takeaway');
create type public.order_status as enum ('sent', 'flagged_fake');
create type public.waiter_call_kind as enum ('waiter', 'bill', 'water');
create type public.waiter_call_status as enum ('open', 'handled');
create type public.payment_method as enum ('cod', 'baridimob', 'ccp', 'cash');
create type public.payment_status as enum ('pending', 'approved', 'rejected');
create type public.kit_stage as enum ('ordered', 'mockup', 'approved', 'printed', 'shipped', 'delivered', 'paid');
create type public.admin_call_outcome as enum ('interested', 'call_back', 'not_interested', 'no_answer');
create type public.ai_import_status as enum ('processing', 'done', 'failed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- A {"fr": "...", "ar": "..."} object with string values only.
create or replace function public.is_i18n_text(v jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(v) = 'object'
     and not exists (
       select 1 from jsonb_each(v) e
       where e.key not in ('fr', 'ar') or jsonb_typeof(e.value) <> 'string'
     )
$$;

create sequence public.payment_reference_seq start 1;

create or replace function public.next_payment_reference()
returns text language sql volatile as $$
  select 'QR-' || lpad(nextval('public.payment_reference_seq')::text, 4, '0')
$$;

-- 6 chars, no ambiguous letters (0/O, 1/I/L).
create or replace function public.random_code(len int default 6)
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, len)
$$;

-- ---------------------------------------------------------------------------
-- Profiles & platform
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  id boolean primary key default true check (id), -- single row
  price_monthly int not null default 2500,
  price_semiannual int not null default 13500,
  price_annual int not null default 24000,
  trial_days int not null default 14,
  grace_days int not null default 7,
  baridimob_rip text,
  ccp_number text,
  ccp_key text,
  ccp_holder text,
  sms_provider text not null default 'console',
  otp_max_per_hour int not null default 3,
  waiter_call_cooldown_sec int not null default 120,
  first_order_otp boolean not null default true,
  block_after_reports int not null default 2,
  ai_imports_per_trial int not null default 5,
  kit_price int not null default 6000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;

create table public.templates (
  key text primary key,
  name text not null,
  is_active boolean not null default true,
  preview_path text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reserved_slugs (
  slug text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Restaurants & membership
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 40 and slug !~ '-menu$'),
  name text not null check (length(name) between 1 and 80),
  type public.restaurant_type not null default 'restaurant',
  wilaya_code smallint check (wilaya_code between 1 and 69),
  commune text,
  address text,
  logo_path text,
  cover_path text,
  template_key text not null default 'cafe' references public.templates (key),
  primary_color text check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  default_locale text not null default 'fr' check (default_locale in ('fr', 'ar')),
  enabled_locales text[] not null default '{fr,ar}',
  whatsapp_order_phone text check (whatsapp_order_phone ~ '^\+213[0-9]{8,9}$'),
  timezone text not null default 'Africa/Algiers',
  -- subscription
  status public.restaurant_status not null default 'trial',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  paid_until timestamptz,
  plan public.subscription_plan,
  payment_reference text not null unique default public.next_payment_reference(),
  referral_code text not null unique default public.random_code(6),
  referred_by uuid references public.restaurants (id),
  -- ordering
  orders_enabled boolean not null default false,
  delivery_enabled boolean not null default false,
  takeaway_enabled boolean not null default true,
  min_order int not null default 0 check (min_order >= 0),
  eta_label text,
  -- onboarding
  onboarding_step smallint not null default 1,
  went_live_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurants_name_trgm on public.restaurants using gin (name extensions.gin_trgm_ops);
create index restaurants_status_idx on public.restaurants (status) where deleted_at is null;
create index restaurants_trial_ends_idx on public.restaurants (trial_ends_at) where status = 'trial';

create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  invited_phone text,
  invite_token text unique,
  invite_status public.invite_status not null default 'accepted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);
create index restaurant_members_user_idx on public.restaurant_members (user_id) where invite_status = 'accepted';

create table public.slug_history (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  old_slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens time not null,
  closes time not null, -- closes < opens means past midnight
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opening_hours_restaurant_idx on public.opening_hours (restaurant_id, weekday);

create table public.opening_exceptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  date date not null,
  closed boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, date)
);

create table public.social_links (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  instagram text,
  facebook text,
  tiktok text,
  maps_url text,
  google_review_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.menu_schedules (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  starts time not null,
  ends time not null,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name jsonb not null check (public.is_i18n_text(name)),
  icon text,
  position int not null default 0,
  is_visible boolean not null default true,
  schedule_id uuid references public.menu_schedules (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_restaurant_idx on public.categories (restaurant_id, position) where deleted_at is null;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name jsonb not null check (public.is_i18n_text(name)),
  description jsonb not null default '{}' check (public.is_i18n_text(description)),
  base_price int check (base_price >= 0),
  photos text[] not null default '{}',
  tags public.item_tag[] not null default '{}',
  is_sold_out boolean not null default false,
  is_visible boolean not null default true,
  position int not null default 0,
  ai_confidence jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_category_idx on public.items (category_id, position) where deleted_at is null;
create index items_restaurant_idx on public.items (restaurant_id) where deleted_at is null;

-- restaurant_id is denormalized onto variants/extras for cheap RLS checks.
create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  name jsonb not null check (public.is_i18n_text(name)),
  price int not null check (price >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index item_variants_item_idx on public.item_variants (item_id, position);

create table public.item_extras (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  name jsonb not null check (public.is_i18n_text(name)),
  price int not null default 0 check (price >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index item_extras_item_idx on public.item_extras (item_id, position);

-- Keep the denormalized restaurant_id honest.
create or replace function public.sync_child_restaurant_id()
returns trigger language plpgsql as $$
begin
  select restaurant_id into new.restaurant_id from public.items where id = new.item_id;
  return new;
end $$;

create or replace function public.check_item_category_restaurant()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.categories c where c.id = new.category_id and c.restaurant_id = new.restaurant_id
  ) then
    raise exception 'category % does not belong to restaurant %', new.category_id, new.restaurant_id;
  end if;
  return new;
end $$;

create trigger items_category_restaurant before insert or update of category_id, restaurant_id on public.items
  for each row execute function public.check_item_category_restaurant();
create trigger item_variants_restaurant before insert or update of item_id on public.item_variants
  for each row execute function public.sync_child_restaurant_id();
create trigger item_extras_restaurant before insert or update of item_id on public.item_extras
  for each row execute function public.sync_child_restaurant_id();

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null check (code ~ '^[A-Za-z0-9]{2,12}$'),
  label text not null,
  zone text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  fee int not null default 0 check (fee >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Diner activity
-- ---------------------------------------------------------------------------
create table public.menu_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind public.menu_event_kind not null,
  table_id uuid references public.tables (id) on delete set null,
  source public.traffic_source,
  item_id uuid references public.items (id) on delete set null,
  session_id text,
  created_at timestamptz not null default now()
);
-- Stats always filter by restaurant and date range. BRIN keeps the time index tiny.
create index menu_events_restaurant_time_idx on public.menu_events (restaurant_id, created_at desc);
create index menu_events_time_brin on public.menu_events using brin (created_at);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  public_id text not null default public.random_code(6),
  mode public.order_mode not null,
  customer_name text not null,
  customer_phone text not null,
  address text,
  zone_id uuid references public.delivery_zones (id) on delete set null,
  note text,
  items jsonb not null,
  subtotal int not null check (subtotal >= 0),
  delivery_fee int not null default 0 check (delivery_fee >= 0),
  status public.order_status not null default 'sent',
  locale text not null default 'fr',
  source public.traffic_source,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, public_id)
);
create index orders_restaurant_time_idx on public.orders (restaurant_id, created_at desc);
create index orders_phone_idx on public.orders (customer_phone);

create table public.verified_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create table public.blocked_phones (
  phone text primary key,
  reason text,
  reports int not null default 0,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  kind public.waiter_call_kind not null default 'waiter',
  status public.waiter_call_status not null default 'open',
  handled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  updated_at timestamptz not null default now()
);
create index waiter_calls_open_idx on public.waiter_calls (restaurant_id, created_at desc) where status = 'open';

-- ---------------------------------------------------------------------------
-- Billing, kit, notifications
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  method public.payment_method not null,
  plan public.subscription_plan not null,
  amount int not null check (amount > 0),
  reference text not null,
  receipt_path text,
  status public.payment_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  receipt_pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_queue_idx on public.payments (created_at) where status = 'pending';
create index payments_restaurant_idx on public.payments (restaurant_id, created_at desc);

create table public.kit_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  stands_count int not null default 0 check (stands_count >= 0),
  posters_count int not null default 0 check (posters_count >= 0),
  wilaya_code smallint check (wilaya_code between 1 and 69),
  commune text,
  address text,
  phone text,
  cod_amount int not null default 0,
  stage public.kit_stage not null default 'ordered',
  tracking_number text,
  mockup_path text,
  owner_feedback text,
  timeline jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_restaurant_idx on public.notifications (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create table public.admin_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  admin_id uuid not null references auth.users (id),
  outcome public.admin_call_outcome not null,
  next_action text,
  next_action_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  admin_id uuid not null references auth.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id),
  action text not null,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_time_idx on public.audit_log (created_at desc);
create index audit_log_restaurant_idx on public.audit_log (restaurant_id, created_at desc);

create table public.ai_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  source_paths text[] not null,
  status public.ai_import_status not null default 'processing',
  result jsonb,
  error text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fixed-window rate limiter used by OTP, order submit and waiter-call RPCs.
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table that has the column
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- New auth user -> profile row (phone comes from Supabase phone auth).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, full_name, locale)
  values (
    new.id,
    case when new.phone is null or new.phone = '' then null
         when left(new.phone, 1) = '+' then new.phone else '+' || new.phone end,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'fr')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
