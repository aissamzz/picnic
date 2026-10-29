-- Phase 9: team invites, hours and links settings, nightly maintenance.

-- Demo menus and their internal route.
insert into public.reserved_slugs (slug) values
  ('modele'), ('template-1'), ('template-2'), ('template-3'), ('template-4'), ('template-5'), ('template-6'), ('template-7'), ('template-8'), ('template-9')
on conflict do nothing;

-- Combos and best sellers: owners build fixed-price combos (a burger + fries +
-- a drink...) shown in their own section of every template, orderable like a dish.

create table public.combos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name jsonb not null check (public.is_i18n_text(name)),
  description jsonb not null default '{}' check (public.is_i18n_text(description)),
  price int not null check (price between 0 and 1000000),
  photo text,
  -- Dishes it contains (display only: the combo has its own price).
  item_ids uuid[] not null default '{}',
  is_visible boolean not null default true,
  is_sold_out boolean not null default false,
  position int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index combos_restaurant_idx on public.combos (restaurant_id, position) where deleted_at is null;
create trigger combos_updated_at before update on public.combos for each row execute function public.set_updated_at();

alter table public.combos enable row level security;
grant select, insert, update, delete on public.combos to authenticated;
create policy combos_select on public.combos for select to authenticated using (public.is_member(restaurant_id));
create policy combos_insert on public.combos for insert to authenticated with check (public.can_edit_menu(restaurant_id));
create policy combos_update on public.combos for update to authenticated using (public.can_edit_menu(restaurant_id)) with check (public.can_edit_menu(restaurant_id));
create policy combos_delete on public.combos for delete to authenticated using (public.can_edit_menu(restaurant_id));

-- Public menu: the original payload plus combos (with the names of what they contain).
do $$
begin
  if to_regprocedure('public._public_menu_core(text)') is null then
    alter function public.get_public_menu(text) rename to _public_menu_core;
  end if;
end $$;
revoke execute on function public._public_menu_core(text) from public, anon, authenticated;

create or replace function public.get_public_menu(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v jsonb := public._public_menu_core(p_slug);
  v_id uuid;
begin
  if v is null then return null; end if;
  v_id := (v #>> '{restaurant,id}')::uuid;
  return v || jsonb_build_object('combos', case when (v #>> '{restaurant,is_paused}')::boolean then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', co.id,
      'name', co.name,
      'description', co.description,
      'price', co.price,
      'photo', co.photo,
      'is_sold_out', co.is_sold_out,
      'includes', coalesce((
        select jsonb_agg(i.name order by array_position(co.item_ids, i.id))
        from public.items i
        where i.id = any (co.item_ids) and i.restaurant_id = v_id and i.deleted_at is null
      ), '[]')
    ) order by co.position, co.created_at)
    from public.combos co
    where co.restaurant_id = v_id and co.deleted_at is null and co.is_visible
  ), '[]') end);
end $fn$;
grant execute on function public.get_public_menu(text) to anon, authenticated;

-- Orders accept combo lines (item_id = the combo's id).
create or replace function public.submit_order(p_restaurant_id uuid, p_order jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  r public.restaurants%rowtype;
  v_mode public.order_mode := (p_order ->> 'mode')::public.order_mode;
  v_phone text := btrim(p_order ->> 'customer_phone');
  v_name text := btrim(p_order ->> 'customer_name');
  v_address text := nullif(btrim(coalesce(p_order ->> 'address', '')), '');
  v_note text := nullif(btrim(coalesce(p_order ->> 'note', '')), '');
  v_session text := coalesce(p_order ->> 'session_id', '');
  v_source public.traffic_source;
  v_zone public.delivery_zones%rowtype;
  v_line jsonb;
  v_item record;
  v_is_combo boolean;
  v_variant_name jsonb;
  v_extras jsonb;
  v_extras_total int;
  v_unit int;
  v_qty int;
  v_lines jsonb := '[]';
  v_subtotal int := 0;
  v_fee int := 0;
  v_order public.orders%rowtype;
begin
  select * into r from public.restaurants where id = p_restaurant_id and deleted_at is null;
  if not found
     or not r.orders_enabled
     or r.status not in ('trial', 'active', 'grace')
     or r.whatsapp_order_phone is null then
    raise exception 'ordering_unavailable';
  end if;
  if (v_mode = 'delivery' and not r.delivery_enabled) or (v_mode = 'takeaway' and not r.takeaway_enabled) then
    raise exception 'mode_unavailable';
  end if;
  if v_phone !~ '^\+213[0-9]{8,9}$' then raise exception 'invalid_phone'; end if;
  if length(coalesce(v_name, '')) not between 2 and 60 then raise exception 'invalid_name'; end if;
  if length(coalesce(v_note, '')) > 300 or length(coalesce(v_address, '')) > 200 then raise exception 'too_long'; end if;
  if length(v_session) not between 8 and 64 then raise exception 'invalid_session'; end if;

  if exists (select 1 from public.blocked_phones where phone = v_phone and blocked_at is not null) then
    raise exception 'phone_blocked';
  end if;
  if not public.hit_rate_limit('order:' || v_phone, 5, 600) or not public.hit_rate_limit('order-s:' || v_session, 8, 600) then
    raise exception 'rate_limited';
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') not between 1 and 50 then
    raise exception 'empty_cart';
  end if;

  for v_line in select * from jsonb_array_elements(p_order -> 'items') loop
    v_qty := (v_line ->> 'qty')::int;
    if v_qty is null or v_qty not between 1 and 50 then raise exception 'invalid_quantity'; end if;

    select i.id, i.name, i.base_price into v_item
    from public.items i join public.categories c on c.id = i.category_id
    where i.id = (v_line ->> 'item_id')::uuid and i.restaurant_id = r.id
      and i.deleted_at is null and i.is_visible and not i.is_sold_out
      and c.deleted_at is null and c.is_visible;
    v_is_combo := false;
    if not found then
      -- A combo: fixed price, no sizes or extras.
      select co.id, co.name, co.price as base_price into v_item
      from public.combos co
      where co.id = (v_line ->> 'item_id')::uuid and co.restaurant_id = r.id
        and co.deleted_at is null and co.is_visible and not co.is_sold_out;
      if not found then raise exception 'item_unavailable' using detail = coalesce(v_line ->> 'item_id', ''); end if;
      v_is_combo := true;
    end if;

    v_variant_name := null;
    if v_is_combo and nullif(v_line ->> 'variant_id', '') is not null then
      raise exception 'item_unavailable' using detail = v_item.id::text;
    elsif v_is_combo then
      v_unit := v_item.base_price;
    elsif nullif(v_line ->> 'variant_id', '') is not null then
      select v.name, v.price into v_variant_name, v_unit from public.item_variants v
      where v.id = (v_line ->> 'variant_id')::uuid and v.item_id = v_item.id;
      if not found then raise exception 'item_unavailable' using detail = v_item.id::text; end if;
    elsif exists (select 1 from public.item_variants where item_id = v_item.id) then
      raise exception 'variant_required' using detail = v_item.id::text;
    else
      v_unit := v_item.base_price;
    end if;
    if v_unit is null then raise exception 'item_unavailable' using detail = v_item.id::text; end if;

    select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'price', x.price) order by x.position), '[]'), coalesce(sum(x.price), 0)
    into v_extras, v_extras_total
    from public.item_extras x
    where x.item_id = v_item.id
      and x.id in (select (e)::uuid from jsonb_array_elements_text(coalesce(v_line -> 'extra_ids', '[]')) e);
    if jsonb_array_length(v_extras) <> jsonb_array_length(coalesce(v_line -> 'extra_ids', '[]')) then
      raise exception 'item_unavailable' using detail = v_item.id::text;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'item_id', v_item.id,
      'name', v_item.name,
      'variant', v_variant_name,
      'extras', v_extras,
      'unit_price', v_unit + v_extras_total,
      'qty', v_qty,
      'line_total', (v_unit + v_extras_total) * v_qty
    );
    v_subtotal := v_subtotal + (v_unit + v_extras_total) * v_qty;
  end loop;

  if v_subtotal < r.min_order then
    raise exception 'below_minimum' using detail = r.min_order::text;
  end if;

  if v_mode = 'delivery' then
    if v_address is null then raise exception 'address_required'; end if;
    if exists (select 1 from public.delivery_zones where restaurant_id = r.id) then
      select * into v_zone from public.delivery_zones
      where id = nullif(p_order ->> 'zone_id', '')::uuid and restaurant_id = r.id;
      if not found then raise exception 'zone_required'; end if;
      v_fee := v_zone.fee;
    end if;
  end if;

  v_source := case when p_order ->> 'source' in ('instagram', 'facebook', 'tiktok', 'poster', 'direct', 'whatsapp')
                   then (p_order ->> 'source')::public.traffic_source else 'direct' end;

  insert into public.orders (restaurant_id, mode, customer_name, customer_phone, address, zone_id, note, items, subtotal, delivery_fee, locale, source)
  values (r.id, v_mode, v_name, v_phone, case when v_mode = 'delivery' then v_address end, v_zone.id, v_note, v_lines, v_subtotal, v_fee,
          case when p_order ->> 'locale' = 'ar' then 'ar' else 'fr' end, v_source)
  returning * into v_order;

  insert into public.menu_events (restaurant_id, kind, source, session_id)
  values (r.id, 'order_sent', v_source, v_session);

  return jsonb_build_object(
    'public_id', v_order.public_id,
    'restaurant_name', r.name,
    'whatsapp', r.whatsapp_order_phone,
    'mode', v_mode,
    'items', v_lines,
    'subtotal', v_subtotal,
    'delivery_fee', v_fee,
    'total', v_subtotal + v_fee,
    'zone_name', v_zone.name,
    'eta_label', r.eta_label
  );
end $$;

-- ---------------------------------------------------------------------------
-- Team: owners invite staff by phone; the invite is a share link.
-- ---------------------------------------------------------------------------
create or replace function public.invite_staff(p_restaurant_id uuid, p_phone text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_token text;
begin
  if not public.can_edit_settings(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_phone !~ '^\+213[5-7][0-9]{8}$' then raise exception 'phone_invalid'; end if;
  if exists (
    select 1 from public.restaurant_members m join public.profiles p on p.id = m.user_id
    where m.restaurant_id = p_restaurant_id and m.invite_status = 'accepted' and p.phone = p_phone
  ) then raise exception 'already_member'; end if;
  -- Same phone invited again: same link.
  select invite_token into v_token from public.restaurant_members
  where restaurant_id = p_restaurant_id and invited_phone = p_phone and invite_status = 'pending';
  if v_token is not null then return v_token; end if;
  if (select count(*) from public.restaurant_members where restaurant_id = p_restaurant_id and role = 'staff') >= 20 then
    raise exception 'team_full';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.restaurant_members (restaurant_id, role, invited_phone, invite_token, invite_status)
  values (p_restaurant_id, 'staff', p_phone, v_token, 'pending');
  perform public.write_audit('member.invited', p_restaurant_id, jsonb_build_object('phone', p_phone));
  return v_token;
end $$;

create or replace function public.remove_member(p_member_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare m public.restaurant_members;
begin
  select * into m from public.restaurant_members where id = p_member_id for update;
  if not found or not public.is_owner(m.restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if m.role <> 'staff' then raise exception 'cannot_remove_owner'; end if;
  delete from public.restaurant_members where id = p_member_id;
  perform public.write_audit(case when m.invite_status = 'pending' then 'member.invite_cancelled' else 'member.removed' end,
    m.restaurant_id, jsonb_build_object('user_id', m.user_id, 'phone', m.invited_phone));
end $$;

-- Team list for owners: members with their name and phone, pending invites.
create or replace function public.team_members(p_restaurant_id uuid)
returns table (id uuid, role public.member_role, status public.invite_status, full_name text, phone text, invite_token text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.role, m.invite_status, p.full_name, coalesce(p.phone, m.invited_phone), m.invite_token, m.created_at
  from public.restaurant_members m left join public.profiles p on p.id = m.user_id
  where m.restaurant_id = p_restaurant_id and public.is_owner(p_restaurant_id)
  order by m.role, m.created_at
$$;

-- ---------------------------------------------------------------------------
-- Hours, exceptions and links, saved in one go (RLS applies: invoker).
-- p_hours: [{weekday, opens, closes}], p_exceptions: [{date, closed, note}], p_links: {instagram, ...}
-- ---------------------------------------------------------------------------
create or replace function public.save_hours_and_links(p_restaurant_id uuid, p_hours jsonb, p_exceptions jsonb, p_links jsonb)
returns void language plpgsql volatile security invoker set search_path = '' as $$
begin
  if not public.can_edit_settings(p_restaurant_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.opening_hours where restaurant_id = p_restaurant_id;
  insert into public.opening_hours (restaurant_id, weekday, opens, closes)
  select p_restaurant_id, (h ->> 'weekday')::smallint, (h ->> 'opens')::time, (h ->> 'closes')::time
  from jsonb_array_elements(coalesce(p_hours, '[]')) h;
  delete from public.opening_exceptions where restaurant_id = p_restaurant_id;
  insert into public.opening_exceptions (restaurant_id, date, closed, note)
  select p_restaurant_id, (e ->> 'date')::date, coalesce((e ->> 'closed')::boolean, true), nullif(btrim(e ->> 'note'), '')
  from jsonb_array_elements(coalesce(p_exceptions, '[]')) e;
  insert into public.social_links (restaurant_id, instagram, facebook, tiktok, maps_url, google_review_url)
  values (p_restaurant_id, nullif(btrim(p_links ->> 'instagram'), ''), nullif(btrim(p_links ->> 'facebook'), ''),
    nullif(btrim(p_links ->> 'tiktok'), ''), nullif(btrim(p_links ->> 'maps_url'), ''), nullif(btrim(p_links ->> 'google_review_url'), ''))
  on conflict (restaurant_id) do update set
    instagram = excluded.instagram, facebook = excluded.facebook, tiktok = excluded.tiktok,
    maps_url = excluded.maps_url, google_review_url = excluded.google_review_url, updated_at = now();
end $$;

revoke execute on function public.invite_staff(uuid, text), public.remove_member(uuid), public.team_members(uuid),
  public.save_hours_and_links(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.invite_staff(uuid, text), public.remove_member(uuid), public.team_members(uuid),
  public.save_hours_and_links(uuid, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Nightly maintenance (service role, from POST /api/cron/nightly).
-- Returns the storage paths the caller must delete: Storage files can only be
-- removed through the Storage API, so the rows are cleared here first.
-- ---------------------------------------------------------------------------
create or replace function public.run_maintenance()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_codes int;
  v_limits int;
  v_imports text[];
  v_photos text[];
begin
  -- Codes: issued ones past their timer expire; requests nobody answered in a day are dropped.
  with x as (
    update public.phone_codes set
      status = case when status = 'issued' then 'expired'::public.code_status else 'cancelled'::public.code_status end,
      code_hash = null
    where (status = 'issued' and expires_at < now()) or (status = 'requested' and requested_at < now() - interval '1 day')
    returning 1
  ) select count(*) into v_codes from x;

  with x as (delete from public.rate_limits where window_start < now() - interval '2 days' returning 1)
  select count(*) into v_limits from x;

  -- AI import sources (photos/PDF of the paper menu) are kept 30 days for support.
  with old as (
    select id, source_paths from public.ai_imports
    where created_at < now() - interval '30 days' and cardinality(source_paths) > 0 for update
  ), cleared as (
    update public.ai_imports a set source_paths = '{}' from old where a.id = old.id
  ) select coalesce(array_agg(p order by p), '{}') into v_imports from old, unnest(old.source_paths) p;

  -- Photos of dishes deleted more than 30 days ago (the undo window is long gone).
  with old as (
    select id, photos from public.items
    where deleted_at < now() - interval '30 days' and cardinality(photos) > 0 for update
  ), cleared as (
    update public.items i set photos = '{}' from old where i.id = old.id
  ) select coalesce(array_agg(p order by p), '{}') into v_photos from old, unnest(old.photos) p;
  -- Same for combos deleted more than 30 days ago.
  with old as (
    select id, photo from public.combos where deleted_at < now() - interval '30 days' and photo is not null for update
  ), cleared as (
    update public.combos c set photo = null from old where c.id = old.id
  ) select v_photos || coalesce(array_agg(photo order by photo), '{}') into v_photos from old;

  return jsonb_build_object('codes', v_codes, 'rate_limits', v_limits, 'import_paths', to_jsonb(v_imports), 'photo_paths', to_jsonb(v_photos));
end $$;

revoke execute on function public.run_maintenance() from public, anon, authenticated;
grant execute on function public.run_maintenance() to service_role;
