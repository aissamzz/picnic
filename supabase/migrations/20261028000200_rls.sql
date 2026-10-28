-- Row level security.
--
-- Model:
--   anon           -> no table access at all. Public menus go through
--                     security-definer RPCs (see public_api migration).
--   authenticated  -> rows of restaurants they are an accepted member of.
--                     Owners: everything for their restaurant.
--                     Staff: menu, prices, sold-out, stats, waiter calls.
--                     Never payments, members, billing columns or settings.
--   super admin    -> everything, via public.is_super_admin().
--   service_role   -> bypasses RLS (jobs, webhooks).
--
-- Menu writes also require the subscription to allow editing
-- (status not expired/suspended): see public.can_edit_menu().

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer: they read restaurant_members
-- without recursing into its own policies)
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.member_role(rid uuid)
returns public.member_role language sql stable security definer set search_path = '' as $$
  select m.role from public.restaurant_members m
  where m.restaurant_id = rid and m.user_id = auth.uid() and m.invite_status = 'accepted'
  limit 1
$$;

create or replace function public.is_member(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.member_role(rid) is not null or public.is_super_admin()
$$;

create or replace function public.is_owner(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.member_role(rid) = 'owner' or public.is_super_admin()
$$;

-- Members may edit the menu unless the subscription locks it.
-- Super admins are not locked out (support edits).
create or replace function public.can_edit_menu(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or (
        public.member_role(rid) is not null
        and exists (
          select 1 from public.restaurants r
          where r.id = rid and r.deleted_at is null and r.status not in ('expired', 'suspended')
        )
      )
$$;

create or replace function public.can_edit_settings(rid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or (
        public.member_role(rid) = 'owner'
        and exists (
          select 1 from public.restaurants r
          where r.id = rid and r.deleted_at is null and r.status not in ('expired', 'suspended')
        )
      )
$$;

-- Restaurants the caller belongs to (used by the app shell).
create or replace function public.my_restaurant_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.restaurant_id from public.restaurant_members m
  where m.user_id = auth.uid() and m.invite_status = 'accepted'
$$;

-- ---------------------------------------------------------------------------
-- Baseline privileges: start from nothing, grant explicitly.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant usage on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_super_admin()
  -- owners see their team's names and phones
  or exists (
    select 1 from public.restaurant_members m
    where m.user_id = profiles.id and m.invite_status = 'accepted' and public.is_owner(m.restaurant_id)
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- restaurants: billing columns are not granted to authenticated.
-- Owners/admins read them through the restaurant_billing view.
-- Creation, slug change and status changes go through RPCs.
-- ---------------------------------------------------------------------------
grant select (
  id, slug, name, type, wilaya_code, commune, address, logo_path, cover_path, template_key,
  primary_color, default_locale, enabled_locales, whatsapp_order_phone, timezone,
  status, trial_ends_at, orders_enabled, delivery_enabled, takeaway_enabled, min_order, eta_label,
  onboarding_step, went_live_at, deleted_at, created_at, updated_at
) on public.restaurants to authenticated;

grant update (
  name, type, wilaya_code, commune, address, logo_path, cover_path, template_key,
  primary_color, default_locale, enabled_locales, whatsapp_order_phone, timezone,
  orders_enabled, delivery_enabled, takeaway_enabled, min_order, eta_label, onboarding_step
) on public.restaurants to authenticated;

create policy restaurants_select on public.restaurants for select to authenticated
  using (public.is_member(id));
create policy restaurants_update on public.restaurants for update to authenticated
  using (public.can_edit_settings(id)) with check (public.can_edit_settings(id));

create view public.restaurant_billing with (security_barrier = true) as
  select r.id, r.status, r.trial_ends_at, r.paid_until, r.plan, r.payment_reference,
         r.referral_code, r.referred_by
  from public.restaurants r
  where public.is_owner(r.id);
comment on view public.restaurant_billing is
  'Billing columns for owners and super admins. Runs as the view owner on purpose: the filter is the access check.';
revoke all on public.restaurant_billing from anon, authenticated;
grant select on public.restaurant_billing to authenticated;

-- ---------------------------------------------------------------------------
-- restaurant_members: owners manage; staff see only their own row.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.restaurant_members to authenticated;

create policy members_select on public.restaurant_members for select to authenticated
  using (user_id = auth.uid() or public.is_owner(restaurant_id));
create policy members_insert on public.restaurant_members for insert to authenticated
  with check (public.can_edit_settings(restaurant_id) and role = 'staff');
create policy members_update on public.restaurant_members for update to authenticated
  using (public.can_edit_settings(restaurant_id) and role = 'staff')
  with check (public.can_edit_settings(restaurant_id) and role = 'staff');
create policy members_delete on public.restaurant_members for delete to authenticated
  using (public.is_owner(restaurant_id) and role = 'staff');

-- ---------------------------------------------------------------------------
-- Settings tables: members read, owners write.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['opening_hours', 'opening_exceptions', 'social_links', 'delivery_zones', 'tables'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(restaurant_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_settings(restaurant_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_settings(restaurant_id)) with check (public.can_edit_settings(restaurant_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_settings(restaurant_id))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Menu tables: members (owner + staff) read and write while editable.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['menu_schedules', 'categories', 'items', 'item_variants', 'item_extras'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(restaurant_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_edit_menu(restaurant_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_edit_menu(restaurant_id)) with check (public.can_edit_menu(restaurant_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_edit_menu(restaurant_id))', t || '_delete', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Activity: members read; writes come from RPCs (anon diners) only.
-- ---------------------------------------------------------------------------
grant select on public.menu_events to authenticated;
create policy menu_events_select on public.menu_events for select to authenticated
  using (public.is_member(restaurant_id));

-- Orders contain customer phones: restaurant members and admins only.
grant select on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
  using (public.is_member(restaurant_id));

grant select on public.waiter_calls to authenticated;
grant update (status, handled_by, handled_at) on public.waiter_calls to authenticated;
create policy waiter_calls_select on public.waiter_calls for select to authenticated
  using (public.is_member(restaurant_id));
-- Handling a call stays possible even when the subscription is expired.
create policy waiter_calls_update on public.waiter_calls for update to authenticated
  using (public.is_member(restaurant_id)) with check (public.is_member(restaurant_id));

-- verified_customers, blocked_phones, rate_limits: no client access (RPCs only).
create policy verified_customers_admin on public.verified_customers for select to authenticated
  using (public.is_super_admin());
grant select on public.verified_customers to authenticated;
create policy blocked_phones_admin on public.blocked_phones for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
grant select, insert, update, delete on public.blocked_phones to authenticated;

-- ---------------------------------------------------------------------------
-- Billing: owners only. Owners may only create pending payments.
-- ---------------------------------------------------------------------------
grant select on public.payments to authenticated;
grant insert (restaurant_id, method, plan, amount, reference, receipt_path) on public.payments to authenticated;
create policy payments_select on public.payments for select to authenticated
  using (public.is_owner(restaurant_id));
create policy payments_insert on public.payments for insert to authenticated
  with check (public.member_role(restaurant_id) = 'owner' and status = 'pending');

grant select on public.kit_orders to authenticated;
grant insert (restaurant_id, stands_count, posters_count, wilaya_code, commune, address, phone) on public.kit_orders to authenticated;
create policy kit_orders_select on public.kit_orders for select to authenticated
  using (public.is_owner(restaurant_id));
create policy kit_orders_insert on public.kit_orders for insert to authenticated
  with check (public.member_role(restaurant_id) = 'owner' and stage = 'ordered');

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (
  user_id = auth.uid()
  or (user_id is null and public.is_member(restaurant_id))
  or public.is_super_admin()
);
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_member(restaurant_id)))
  with check (user_id = auth.uid() or (user_id is null and public.is_member(restaurant_id)));

grant select on public.ai_imports to authenticated;
create policy ai_imports_select on public.ai_imports for select to authenticated
  using (public.is_member(restaurant_id));

-- ---------------------------------------------------------------------------
-- Admin-only tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['admin_calls', 'admin_notes', 'reserved_slugs', 'platform_settings', 'slug_history'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t || '_admin', t);
  end loop;
end $$;

-- Audit log is append-only, written by security-definer functions.
grant select on public.audit_log to authenticated;
create policy audit_log_admin on public.audit_log for select to authenticated using (public.is_super_admin());

-- Templates: active ones are public reference data.
grant select on public.templates to anon, authenticated;
grant insert, update, delete on public.templates to authenticated;
create policy templates_select on public.templates for select to anon, authenticated
  using (is_active or public.is_super_admin());
create policy templates_admin on public.templates for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Super admin override for tables whose member policies don't already include it
-- (is_member/is_owner/can_edit_* return true for super admins, so menu and settings
-- tables are covered). Admin writes on billing go through RPCs that audit.

grant execute on function public.is_super_admin(), public.member_role(uuid), public.is_member(uuid),
  public.is_owner(uuid), public.can_edit_menu(uuid), public.can_edit_settings(uuid),
  public.my_restaurant_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit helper (callable only from other security-definer functions / service role)
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(p_action text, p_restaurant_id uuid, p_payload jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_id, action, restaurant_id, payload)
  values (auth.uid(), p_action, p_restaurant_id, coalesce(p_payload, '{}'))
$$;
revoke execute on function public.write_audit(text, uuid, jsonb) from public, anon, authenticated;
